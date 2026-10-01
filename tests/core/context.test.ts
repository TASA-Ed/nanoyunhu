import { afterEach, describe, expect, it, vi } from "vitest";
import { Context } from "#/core/context.ts";
import { HookManager } from "#/plugin/manager.ts";
import type { TTokenTestSuccess } from "#/nano_yunhu/login/token_test.ts";
import type { AppConfig } from "#/types.ts";

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
		message: { persistence: true }
	};
}

function accountFixture(userId = "user-1"): TTokenTestSuccess {
	return {
		success: true,
		userId,
		userName: "Test User",
		token: "test-account-token",
		sn: 1
	};
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Context", () => {
	it("holds the supplied configuration and exposes runtime changes through that same object", () => {
		const config = configFixture();
		const ctx = new Context(config);

		expect(ctx.appConfig).toBe(config);
		config.account = { token: "runtime-token" };
		expect(ctx.appConfig.account).toEqual({ token: "runtime-token" });
		ctx.appConfig.message.persistence = false;
		expect(config.message.persistence).toBe(false);
	});

	it("rejects account access before assignment and keeps the first assigned account", () => {
		const ctx = new Context(configFixture());
		const account = accountFixture();

		expect(() => ctx.accountData).toThrow(Error);
		ctx.accountData = account;
		expect(ctx.accountData).toBe(account);
		expect(() => {
			ctx.accountData = accountFixture("replacement-user");
		}).toThrow(Error);
		expect(ctx.accountData).toBe(account);
		expect(() => {
			ctx.accountData = account;
		}).toThrow(Error);
		expect(ctx.accountData).toBe(account);
	});

	it("rejects plugin manager access before assignment and keeps the first assigned manager", () => {
		const ctx = new Context(configFixture());
		const manager = new HookManager();

		expect(() => ctx.pluginManager).toThrow(Error);
		ctx.pluginManager = manager;
		expect(ctx.pluginManager).toBe(manager);
		expect(() => {
			ctx.pluginManager = new HookManager();
		}).toThrow(Error);
		expect(ctx.pluginManager).toBe(manager);
		expect(() => {
			ctx.pluginManager = manager;
		}).toThrow(Error);
		expect(ctx.pluginManager).toBe(manager);
	});

	it("keeps account and plugin assignment state isolated between contexts", () => {
		const first = new Context(configFixture());
		const second = new Context(configFixture());
		const firstAccount = accountFixture("first-user");
		const secondAccount = accountFixture("second-user");
		const firstManager = new HookManager();
		const secondManager = new HookManager();

		first.accountData = firstAccount;
		first.pluginManager = firstManager;
		expect(() => second.accountData).toThrow(Error);
		expect(() => second.pluginManager).toThrow(Error);

		second.accountData = secondAccount;
		second.pluginManager = secondManager;
		expect(first.accountData).toBe(firstAccount);
		expect(first.pluginManager).toBe(firstManager);
		expect(second.accountData).toBe(secondAccount);
		expect(second.pluginManager).toBe(secondManager);
	});
});
