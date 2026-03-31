import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Logger } from "./utils/logger.ts";
import { AppConfig, AppConfigSchema } from "./types.ts";
import { prettifyError } from "zod/v4/core";

export class ConfigValidationError extends Error {
	constructor(public readonly error: string) {
		super(`Configuration validation failed:\n${error};\n`);
		this.name = "ConfigValidationError";
	}
}

const log = new Logger({ prefix: "Config" });

function assertValidConfig(config: object): asserts config is AppConfig {
	const result = AppConfigSchema.safeParse(config);
	if (!result.success) throw new ConfigValidationError(prettifyError(result.error));
}

function findProjectRoot(startDir: string): string {
	let dir = startDir;
	while (true) {
		if (existsSync(resolve(dir, "package.json"))) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) return process.cwd();
		dir = parent;
	}
}

const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = findProjectRoot(dirname(__filename));
const CONFIG_PATH = resolve(PROJECT_ROOT, "config.json");

/**
 * 启动时读取配置文件，文件不存在时自动创建并写入默认值。
 * 配置不合法时抛出 ConfigValidationError。
 * @throws ConfigValidationError
 */
export function loadConfigOnStarting(): AppConfig {
	if (global.appConfig) return global.appConfig;

	if (!existsSync(CONFIG_PATH)) {
		const DEFAULT_CONFIG: AppConfig = {
			$version: 1,
			host: "127.0.0.1",
			port: 3000,
			protocol: {
				type: "satori",
				// 64 位随机密钥
				accessToken: randomBytes(Math.ceil(64 / 2))
					.toString("hex")
					.slice(0, 64)
			},
			logger: {
				locale: "zh-CN"
			},
			network: {
				httpTimeoutMs: 8000,
				websocketHeartbeatIntervalMs: 30000,
				websocketReconnectDelayMs: 5000
			}
		} as const;

		log.info(`配置文件不存在，已创建: ${CONFIG_PATH}`);
		writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
		log.info(`已读取配置: ${CONFIG_PATH}`);
		return { ...DEFAULT_CONFIG };
	}

	let parsed: object;
	try {
		const raw = readFileSync(CONFIG_PATH, "utf-8");
		parsed = JSON.parse(raw);
		log.info(`已读取配置: ${CONFIG_PATH}`);
	} catch (err) {
		log.error(`解析配置文件失败 (${CONFIG_PATH}):`);
		throw err;
	}

	let needSave = false;
	if (!parsed["$version"]) {
		parsed["$version"] = 1;
		needSave = true;
	}

	assertValidConfig(parsed);
	if (needSave) {
		log.info("配置已更新至 版本", parsed.$version);
		saveConfig(parsed);
	}
	return parsed;
}

/**
 * 将配置写回文件。
 * 配置不合法时抛出 ConfigValidationError，不会写入文件。
 */
export function saveConfig(config: AppConfig): void {
	assertValidConfig(config);
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
	log.debug(`配置已保存: ${CONFIG_PATH}`);
}

/**
 * 运行时写配置
 */
export function persistConfig(log: Logger): void {
	try {
		saveConfig(global.appConfig);
		log.trace("已保存配置:", global.appConfig);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		log.error("保存配置失败:", message);
	}
}
