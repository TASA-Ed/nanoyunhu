import { readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { HOOK_NAMES, type PluginModule } from "./types.js";
import { Logger } from "#/utils/logger.ts";

export interface LoadedPlugin {
	name: string;
	module: PluginModule;
}

export async function loadPluginsFromDir(dir: string): Promise<LoadedPlugin[]> {
	const files = await readdir(dir);
	const jsFiles = files.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));

	const log = new Logger({ prefix: "PluginLoader" });

	const loaded = await Promise.all(
		jsFiles.map(async (file): Promise<LoadedPlugin | null> => {
			const filePath = path.resolve(dir, file);
			const fileUrl = pathToFileURL(filePath).href;

			try {
				const mod: PluginModule = await import(fileUrl);
				validatePlugin(mod, file);
				const pluginName = mod.name ?? path.basename(file, path.extname(file));
				log.debug(`从 "${filePath}" 文件加载插件 "${pluginName}"`);
				return {
					name: pluginName,
					module: mod
				};
			} catch (err) {
				log.error(`未能加载 ${file}:`, err);
				return null;
			}
		})
	);

	return loaded.filter((p): p is LoadedPlugin => p !== null);
}

function validatePlugin(mod: PluginModule, file: string) {
	if (!Array.isArray(mod.hookNameList)) {
		throw new Error(`${file}: 未找到导出 hookNameList: string[]。`);
	}
	for (const hookName of mod.hookNameList) {
		if (!HOOK_NAMES.includes(hookName)) {
			throw new Error(
				`${file}: hookNameList 内定义了未知的 hook "${hookName}"。可用的 hook: ${HOOK_NAMES.join(", ")}。`
			);
		}
		if (typeof mod[hookName] !== "function") {
			throw new Error(`${file}: hookNameList 内定义了 "${hookName}" 但未找到相应导出。`);
		}
	}
}
