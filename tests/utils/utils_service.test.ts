import { describe, expect, it, vi } from "vitest";
import type { Context } from "#/core/context.ts";
import type { ILogger } from "#/types.ts";
import { UtilsService } from "#/utils/utils_service.ts";

vi.mock("#/core/config.ts", () => ({ persistConfig: vi.fn() }));

function context(device: string, platform: "windows" | "linux"): Context {
	const ctx = { appConfig: { account: { device, platform } } } as Context;
	ctx.utils = new UtilsService(ctx);
	return ctx;
}

function logger(): ILogger {
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

describe("UtilsService context isolation", () => {
	it("keeps account identity scoped to each context even for detached callbacks", () => {
		const first = context("first-device", "windows");
		const second = context("second-device", "linux");
		const readFirst = first.utils.getIdAndPlatform;
		const readSecond = second.utils.getIdAndPlatform;
		expect(readFirst(logger())).toEqual({ deviceId: "first-device", platform: "windows" });
		expect(readSecond(logger())).toEqual({ deviceId: "second-device", platform: "linux" });
		first.appConfig.account = { device: "updated-device", platform: "linux" };
		expect(readFirst(logger())).toEqual({ deviceId: "updated-device", platform: "linux" });
		expect(readSecond(logger())).toEqual({ deviceId: "second-device", platform: "linux" });
	});

	it("reads current platform configuration after construction", () => {
		const ctx = context("device", "windows");
		const getPlatform = ctx.utils.getPlatform;
		expect(getPlatform()).toBe("windows");
		ctx.appConfig.account = { device: "device", platform: "linux" };
		expect(getPlatform()).toBe("linux");
	});
});
