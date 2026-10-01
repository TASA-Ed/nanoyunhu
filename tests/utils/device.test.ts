import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CpuInfo, NetworkInterfaceInfo } from "node:os";
import type { Context } from "#/core/context.ts";
import { type AppConfig, type ILogger, PLATFORMS } from "#/types.ts";
import { persistConfig } from "#/core/config.ts";
import {
	generateDeviceId,
	getIdAndPlatform,
	getMemToMiB,
	getPlatform,
	hardwareRequirementsAssessment
} from "#/utils/device.ts";

const os = vi.hoisted(() => ({
	arch: vi.fn<() => string>(),
	cpus: vi.fn<() => CpuInfo[]>(),
	hostname: vi.fn<() => string>(),
	networkInterfaces: vi.fn<() => Record<string, NetworkInterfaceInfo[] | undefined>>(),
	platform: vi.fn<() => NodeJS.Platform>(),
	totalmem: vi.fn<() => number>(),
	release: vi.fn<() => string>(),
	type: vi.fn<() => string>()
}));

vi.mock("node:os", () => os);
vi.mock("#/core/config.ts", () => ({ persistConfig: vi.fn() }));

function networkEntry(mac: string, internal = false): NetworkInterfaceInfo {
	return {
		address: "192.0.2.1",
		netmask: "255.255.255.0",
		family: "IPv4",
		mac,
		internal,
		cidr: "192.0.2.1/24"
	};
}

function makeContext(account?: AppConfig["account"]): Context {
	const appConfig: AppConfig = {
		$version: 3,
		host: "127.0.0.1",
		port: 3000,
		protocol: { type: "satori", accessToken: "test-access-token" },
		logger: { locale: "en-US" },
		account,
		network: {
			httpTimeoutMs: 8000,
			websocketHeartbeatIntervalMs: 30000,
			websocketReconnectDelayMs: 5000,
			websocketHeartbeatResponseTimeoutsMs: 1000
		},
		message: { persistence: false }
	};
	// Only the required context surface is supplied; constructing Context imports the app entrypoint.
	const ctx: Pick<Context, "appConfig"> & { utils: Pick<Context["utils"], "getPlatform"> } = {
		appConfig,
		utils: { getPlatform: () => getPlatform(ctx as Context) }
	};
	return ctx as Context;
}

function makeLogger(): ILogger {
	return {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn<ILogger["child"]>(),
		level: "info"
	};
}

beforeEach(() => {
	vi.resetAllMocks();
	vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
	os.arch.mockReturnValue("x64");
	os.hostname.mockReturnValue("test-host");
	os.platform.mockReturnValue("linux");
	os.totalmem.mockReturnValue(512 * 1024 * 1024);
	const cpu: CpuInfo = {
		model: "Test CPU",
		speed: 2400,
		times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 }
	};
	os.cpus.mockReturnValue([cpu, { ...cpu }]);
	os.networkInterfaces.mockReturnValue({
		ethernet: [networkEntry("BB:00:00:00:00:01"), networkEntry("AA:BB:CC:DD:EE:FF")],
		loopback: [networkEntry("ff:ff:ff:ff:ff:ff", true)],
		virtual: [networkEntry("00:00:00:00:00:00"), networkEntry("")],
		missing: undefined
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("generateDeviceId", () => {
	it("hashes the normalized hardware fingerprint into an eleven-character device suffix", () => {
		expect(generateDeviceId()).toBe("nano-sm1ik8x853z");
	});

	it("is unaffected by interface ordering, MAC casing, loopback, or empty adapters", () => {
		const initial = generateDeviceId();
		os.networkInterfaces.mockReturnValue({
			missing: undefined,
			first: [networkEntry("aa:bb:cc:dd:ee:ff")],
			second: [networkEntry("bb:00:00:00:00:01")]
		});
		expect(generateDeviceId()).toBe(initial);
	});

	it("supports machines without CPU or usable network information", () => {
		os.cpus.mockReturnValue([]);
		os.networkInterfaces.mockReturnValue({ loopback: [networkEntry("00:00:00:00:00:00", true)] });
		expect(generateDeviceId()).toBe("nano-llcnx8736xs");
	});

	it("includes the generation time in the device fingerprint", () => {
		const first = generateDeviceId();
		vi.mocked(Date.now).mockReturnValue(1_800_000_000_001);
		expect(generateDeviceId()).not.toBe(first);
	});
});

describe("memory requirements", () => {
	it("truncates partial MiB rather than rounding", () => {
		os.totalmem.mockReturnValue(255 * 1024 * 1024 + 1024 * 1024 - 1);
		expect(getMemToMiB()).toBe(255);
	});

	it.each([
		{ bytes: 256 * 1024 * 1024 - 1, sufficient: false },
		{ bytes: 256 * 1024 * 1024, sufficient: true },
		{ bytes: 256 * 1024 * 1024 + 1, sufficient: true }
	])("assesses the 256 MiB boundary at $bytes bytes", ({ bytes, sufficient }) => {
		os.totalmem.mockReturnValue(bytes);
		expect(hardwareRequirementsAssessment()).toBe(sufficient);
	});
});

describe("getPlatform", () => {
	it.each([
		{ operatingSystem: "win32", expected: "windows" },
		{ operatingSystem: "linux", expected: "linux" },
		{ operatingSystem: "cygwin", expected: "linux" },
		{ operatingSystem: "android", expected: "android" },
		{ operatingSystem: "darwin", expected: "macos" }
	] as const)("maps $operatingSystem to $expected", ({ operatingSystem, expected }) => {
		os.platform.mockReturnValue(operatingSystem);
		expect(getPlatform(makeContext())).toBe(expected);
	});

	it("gives the configured platform precedence over the host OS", () => {
		expect(getPlatform(makeContext({ platform: "ios" }))).toBe("ios");
	});

	it.each([
		{ random: 0, expected: PLATFORMS[0] },
		{ random: 1 - Number.EPSILON, expected: PLATFORMS[PLATFORMS.length - 1] }
	])("selects a supported fallback at random boundary $random", ({ random, expected }) => {
		os.platform.mockReturnValue("freebsd");
		vi.spyOn(Math, "random").mockReturnValue(random);
		expect(getPlatform(makeContext())).toBe(expected);
	});
});

describe("getIdAndPlatform", () => {
	it("initializes a missing account, persists it once, and reuses its identity", () => {
		const ctx = makeContext();
		const log = makeLogger();
		const first = getIdAndPlatform(ctx, log);
		expect(first).toEqual({ deviceId: "nano-sm1ik8x853z", platform: "linux" });
		expect(ctx.appConfig.account).toEqual({ device: first.deviceId, platform: "linux" });
		expect(persistConfig).toHaveBeenCalledExactlyOnceWith(ctx, log);

		vi.mocked(Date.now).mockReturnValue(1_800_000_001_000);
		expect(getIdAndPlatform(ctx, log)).toEqual(first);
		expect(persistConfig).toHaveBeenCalledTimes(1);
	});

	it("fills a missing platform without replacing a configured device or token", () => {
		const ctx = makeContext({ device: "configured-device", token: "secret-token" });
		const log = makeLogger();
		expect(getIdAndPlatform(ctx, log)).toEqual({ deviceId: "configured-device", platform: "linux" });
		expect(ctx.appConfig.account).toEqual({
			device: "configured-device",
			token: "secret-token",
			platform: "linux"
		});
		expect(persistConfig).toHaveBeenCalledExactlyOnceWith(ctx, log);
	});

	it("fills a missing device while preserving the configured platform", () => {
		const ctx = makeContext({ platform: "ios", token: "secret-token" });
		const log = makeLogger();
		expect(getIdAndPlatform(ctx, log)).toEqual({ deviceId: "nano-sm1ik8x853z", platform: "ios" });
		expect(ctx.appConfig.account).toEqual({ device: "nano-sm1ik8x853z", platform: "ios", token: "secret-token" });
		expect(persistConfig).toHaveBeenCalledExactlyOnceWith(ctx, log);
	});

	it("does not persist an already complete account", () => {
		const ctx = makeContext({ device: "configured-device", platform: "Web", token: "secret-token" });
		expect(getIdAndPlatform(ctx, makeLogger())).toEqual({ deviceId: "configured-device", platform: "Web" });
		expect(ctx.appConfig.account).toEqual({ device: "configured-device", platform: "Web", token: "secret-token" });
		expect(persistConfig).not.toHaveBeenCalled();
	});
});
