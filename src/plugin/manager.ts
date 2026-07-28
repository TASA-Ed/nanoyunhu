import type { HookName, HookContext, HookFn } from "./types.js";
import type { LoadedPlugin } from "./loader.js";
import { Logger } from "#/utils/logger.ts";

type Registry = Map<HookName, { pluginName: string; fn: HookFn }[]>;

export class HookManager {
	private registry: Registry = new Map();
	private log: Logger = new Logger({ prefix: "HookManager" });

	register(plugins: LoadedPlugin[]) {
		for (const { name, module } of plugins) {
			for (const hookName of module.hookNameList) {
				const fn = module[hookName] as HookFn;
				const list = this.registry.get(hookName) ?? [];
				list.push({ pluginName: name, fn });
				this.registry.set(hookName, list);
				this.log.debug(`插件 "${name}" 注册: ${hookName}`);
			}
			this.log.info(`插件 "${name}" 已加载！`);
		}
	}

	async run(hookName: HookName, ctx: HookContext) {
		const handlers = this.registry.get(hookName) ?? [];
		const log = this.log.child(hookName);
		for (const { pluginName, fn } of handlers) {
			try {
				log.debug(`执行插件 "${pluginName}"`);
				await fn(ctx, new Logger({ prefix: pluginName }));
			} catch (err) {
				log.error(`"${pluginName}" 插件执行时发生错误:`, err);
			}
		}
	}
}
