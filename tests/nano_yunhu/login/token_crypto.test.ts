import { createCipheriv, scryptSync } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Context } from "#/core/context.ts";
import { decryptToken, encryptToken } from "#/nano_yunhu/login/token_crypto.ts";
import type { AppConfig, ILogger } from "#/types.ts";

const persistence = vi.hoisted(() => ({
	persistConfig: vi.fn<(ctx: Context, log: ILogger) => void>(),
	savedConfigs: [] as AppConfig[]
}));

vi.mock("#/core/config.ts", () => ({ persistConfig: persistence.persistConfig }));
vi.mock("#/index.ts", () => ({ APP_NAME: "test-app", VERSION: [1, 2, 3] }));
vi.mock("#/nano_yunhu/protocols/utils/protocol_service.ts", () => ({ ProtocolService: class {} }));
vi.mock("#/utils/utils_service.ts", () => ({ UtilsService: class {} }));

function configFixture(account?: AppConfig["account"]): AppConfig {
	const config: AppConfig = {
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
	if (account !== undefined) config.account = account;
	return config;
}

// Fixed salt keeps the wrong-device assertion deterministic: random ciphertext can
// accidentally have valid PKCS padding with a wrong key. Encryption itself is real.
function fixedSaltToken(token: string, device: string): string {
	const salt = Buffer.alloc(16, 1);
	const key = scryptSync(device, salt, 32, { cost: 1024, blockSize: 4 });
	const cipher = createCipheriv("aes-256-ecb", key, null);
	const encrypted = cipher.update(token, "utf8", "hex") + cipher.final("hex");
	return `[crypto:(${encrypted})|salt:(${salt.toString("base64")})]`;
}

beforeEach((): void => {
	persistence.savedConfigs.length = 0;
	persistence.persistConfig.mockReset();
	persistence.persistConfig.mockImplementation((ctx: Context, _log: ILogger): void => {
		persistence.savedConfigs.push(structuredClone(ctx.appConfig));
	});
});

const device = "test-device";
const envelope = /^\[crypto:\([0-9a-f]+\)\|salt:\([A-Za-z0-9+/]{22}==\)\]$/;

describe("token crypto", () => {
	it.each(["plain-token", "云湖 token 🔐\n\u0000é", ""])("roundtrips %j using real crypto", (token: string): void => {
		const config = configFixture({ token: "stored-token", device, platform: "linux" });
		const ctx = new Context(config);
		const before = structuredClone(config);
		const encrypted = encryptToken(token, device);

		expect(encrypted).toMatch(envelope);
		expect(encrypted).not.toBe(token);
		expect(decryptToken(ctx, encrypted, device)).toBe(token);
		expect(config).toEqual(before);
		expect(persistence.persistConfig).not.toHaveBeenCalled();
	});

	it("uses independent salts so the same token produces different decryptable ciphertexts", (): void => {
		const ctx = new Context(configFixture());
		const token = "same-token";
		const first = encryptToken(token, device);
		const second = encryptToken(token, device);

		expect(first).not.toBe(second);
		expect(first.split("|salt:")[1]).not.toBe(second.split("|salt:")[1]);
		expect(first.split("|salt:")[0]).not.toBe(second.split("|salt:")[0]);
		expect(decryptToken(ctx, first, device)).toBe(token);
		expect(decryptToken(ctx, second, device)).toBe(token);
		expect(ctx.appConfig.account).toBeUndefined();
		expect(persistence.persistConfig).not.toHaveBeenCalled();
	});

	it("rejects ciphertext encrypted for a different device without changing or persisting config", (): void => {
		const config = configFixture({ token: "stored-token", device, platform: "linux" });
		const ctx = new Context(config);
		const before = structuredClone(config);
		const encrypted = fixedSaltToken("device-bound-token", device);

		expect(decryptToken(ctx, encrypted, device)).toBe("device-bound-token");
		expect((): string => decryptToken(ctx, encrypted, "different-device")).toThrow();
		expect(config).toEqual(before);
		expect(persistence.persistConfig).not.toHaveBeenCalled();
	});

	it.each([
		"[crypto:(00)]",
		"[crypto:(00)|salt:(AAAAAAAAAAAAAAAAAAAAAA==)|extra:(value)]",
		"[crypto:()|salt:(AAAAAAAAAAAAAAAAAAAAAA==)]",
		"[crypto:(00)|salt:(AAAAAAAAAAAAAAAAAAAAAA==)]"
	])("rejects malformed encrypted input %s without treating it as plaintext", (encrypted: string): void => {
		const config = configFixture({ token: "stored-token", device, platform: "linux" });
		const ctx = new Context(config);
		const before = structuredClone(config);

		expect((): string => decryptToken(ctx, encrypted, device)).toThrow();
		expect(config).toEqual(before);
		expect(persistence.persistConfig).not.toHaveBeenCalled();
	});

	it.each(["plain-token", "明文 token 🔐", ""])(
		"returns plaintext %j and persists an encrypted token when account is absent",
		(token: string): void => {
			const config = configFixture();
			const ctx = new Context(config);
			const before = structuredClone(config);

			expect(decryptToken(ctx, token, device)).toBe(token);

			const encrypted = config.account?.token;
			expect(encrypted).toEqual(expect.stringMatching(envelope));
			expect(config).toEqual({ ...before, account: { token: encrypted } });
			expect(persistence.persistConfig).toHaveBeenCalledTimes(1);
			expect(persistence.savedConfigs).toEqual([config]);
			expect(decryptToken(ctx, encrypted!, device)).toBe(token);
			expect(persistence.persistConfig).toHaveBeenCalledTimes(1);
		}
	);

	it("replaces an existing account token while preserving all other account and config fields", (): void => {
		const account = { token: "old-token", device, platform: "linux" } as const;
		const config = configFixture(account);
		const ctx = new Context(config);
		const before = structuredClone(config);
		const token = "replacement-token";

		expect(decryptToken(ctx, token, device)).toBe(token);

		const encrypted = config.account?.token;
		expect(encrypted).toEqual(expect.stringMatching(envelope));
		expect(config.account).toBe(account);
		expect(config).toEqual({ ...before, account: { ...before.account, token: encrypted } });
		expect(persistence.persistConfig).toHaveBeenCalledTimes(1);
		expect(persistence.savedConfigs).toEqual([config]);
		expect(decryptToken(ctx, encrypted!, device)).toBe(token);
		expect(persistence.persistConfig).toHaveBeenCalledTimes(1);
	});
});
