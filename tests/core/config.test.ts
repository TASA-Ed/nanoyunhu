import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigValidationError, loadConfig, persistConfig, saveConfig } from "#/core/config.ts";
import { Context } from "#/core/context.ts";
import { AppConfigSchema, type AppConfig, type ILogger } from "#/types.ts";

vi.mock("#/index.ts", () => ({ APP_NAME: "test-app", VERSION: [1, 2, 3] }));
vi.mock("#/nano_yunhu/protocols/utils/protocol_service.ts", () => ({ ProtocolService: class {} }));
vi.mock("#/utils/utils_service.ts", () => ({ UtilsService: class {} }));

function configFixture(): AppConfig {
	return {
		$version: 3,
		host: "127.0.0.1",
		port: 3000,
		protocol: { type: "satori", accessToken: "test-access-token" },
		logger: { locale: "zh-CN" },
		network: {
			httpTimeoutMs: 8000,
			websocketHeartbeatIntervalMs: 30000,
			websocketReconnectDelayMs: 5000,
			websocketHeartbeatResponseTimeoutsMs: 1000
		},
		message: { persistence: false }
	};
}

function loggerFixture(): ILogger {
	const logger: ILogger = {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn(() => logger),
		level: "trace"
	};
	return logger;
}

describe("config", () => {
	let directory: string;
	let configPath: string;

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "nanoyunhu-config-"));
		configPath = join(directory, "config.json");
		vi.spyOn(process, "cwd").mockReturnValue(directory);
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		rmSync(directory, { recursive: true, force: true });
	});

	it("creates a valid default configuration and preserves its generated token on reload", () => {
		const config = loadConfig();

		expect(AppConfigSchema.safeParse(config).success).toBe(true);
		expect(config.protocol.accessToken).toMatch(/^[0-9a-f]{64}$/);
		expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(config);
		expect(loadConfig()).toEqual(config);
	});

	it("reads and saves caller changes including optional account settings", () => {
		const config = configFixture();
		config.account = { token: "account-token", device: "test-device", platform: "linux" };
		writeFileSync(configPath, JSON.stringify(config));

		const loaded = loadConfig();
		expect(loaded).toEqual(config);
		loaded.port = 65535;
		loaded.network.websocketReconnectDelayMs = 0;
		loaded.network.websocketHeartbeatResponseTimeoutsMs = 500;
		saveConfig(loaded);

		expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(loaded);
		expect(loadConfig()).toEqual(loaded);
	});

	it.each([undefined, 1, 2])("migrates configuration version %s and persists the upgraded data", (version) => {
		const current = configFixture();
		const { websocketHeartbeatResponseTimeoutsMs: _timeout, ...network } = current.network;
		const { $version: _version, message, ...rest } = current;
		const legacy = {
			...rest,
			network,
			...(version === undefined ? {} : { $version: version }),
			...(version === 2 ? { message } : {})
		};
		writeFileSync(configPath, JSON.stringify(legacy));
		const expected = {
			...current,
			message: { persistence: version === 2 ? false : true }
		};

		expect(loadConfig()).toEqual(expected);
		expect(JSON.parse(readFileSync(configPath, "utf-8"))).toEqual(expected);
		expect(loadConfig()).toEqual(expected);
	});

	it.each([0, 65536])("rejects invalid port %s on save without overwriting an existing file", (port) => {
		const config = configFixture();
		const original = JSON.stringify(config);
		writeFileSync(configPath, original);
		config.port = port;

		expect(() => saveConfig(config)).toThrow(ConfigValidationError);
		expect(readFileSync(configPath, "utf-8")).toBe(original);
	});

	it.each([1, 3])("rejects an invalid version %s configuration without overwriting the file", (version) => {
		const config = configFixture();
		config.$version = version;
		config.host = "";
		const original = JSON.stringify(config);
		writeFileSync(configPath, original);

		expect(() => loadConfig()).toThrow(ConfigValidationError);
		expect(readFileSync(configPath, "utf-8")).toBe(original);
	});

	it("propagates malformed JSON without replacing the file", () => {
		const original = '{"$version": 3,';
		writeFileSync(configPath, original);

		expect(() => loadConfig()).toThrow(SyntaxError);
		expect(readFileSync(configPath, "utf-8")).toBe(original);
	});

	it("persists the current runtime configuration", () => {
		const ctx = new Context(configFixture());
		const logger = loggerFixture();
		ctx.appConfig.account = { token: "new-runtime-token" };

		persistConfig(ctx, logger);

		expect(loadConfig()).toEqual(ctx.appConfig);
		expect(logger.error).not.toHaveBeenCalled();
	});

	it("reports validation failures without throwing or overwriting saved data", () => {
		const config = configFixture();
		saveConfig(config);
		const original = readFileSync(configPath, "utf-8");
		config.port = 0;
		const logger = loggerFixture();

		persistConfig(new Context(config), logger);

		expect(logger.error).toHaveBeenCalledWith(
			"保存配置失败:",
			expect.stringContaining("Configuration validation failed:")
		);
		expect(logger.trace).not.toHaveBeenCalled();
		expect(readFileSync(configPath, "utf-8")).toBe(original);
	});

	it("reports filesystem write failures instead of logging a successful save", () => {
		mkdirSync(configPath);
		const logger = loggerFixture();

		persistConfig(new Context(configFixture()), logger);

		expect(logger.error).toHaveBeenCalledWith("保存配置失败:", expect.stringContaining("config.json"));
		expect(logger.trace).not.toHaveBeenCalled();
	});

	it("normalizes non-Error persistence failures and leaves saved data untouched", () => {
		const ctx = new Context(configFixture());
		saveConfig(ctx.appConfig);
		const original = readFileSync(configPath, "utf-8");
		const logger = loggerFixture();
		vi.spyOn(ctx, "appConfig", "get").mockImplementation(() => {
			throw "configuration unavailable";
		});

		persistConfig(ctx, logger);

		expect(logger.error).toHaveBeenCalledWith("保存配置失败:", "configuration unavailable");
		expect(logger.trace).not.toHaveBeenCalled();
		expect(readFileSync(configPath, "utf-8")).toBe(original);
	});
});
