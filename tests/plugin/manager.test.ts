import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HookManager } from "#/plugin/manager.ts";
import { Logger } from "#/utils/logger.ts";
import type { LoadedPlugin } from "#/plugin/loader.ts";
import type { HookContext, HookFn, HookName } from "#/plugin/types.ts";

const random = vi.hoisted(() => ({ generateString: vi.fn() }));
vi.mock("#/utils/generate.ts", () => ({ generateString: random.generateString }));

function plugin(name: string, hook: HookName, fn: HookFn): LoadedPlugin {
	return { name, module: { hookNameList: [hook], [hook]: fn } };
}

function context(): HookContext {
	return { ctx: {} as HookContext["ctx"], event: { calls: [] as string[] } };
}

beforeEach(() => {
	random.generateString.mockReset().mockReturnValue("ABCD");
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
	vi.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
	vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HookManager", () => {
	it("returns zero counts for an unregistered hook", async () => {
		const manager = new HookManager();
		expect(await manager.run("preStart", context())).toEqual({ count: 0, successCount: 0 });
		expect(Logger.prototype.error).not.toHaveBeenCalled();
	});

	it("awaits each handler in registration order and exposes completed mutations to the next handler", async () => {
		const manager = new HookManager();
		const ctx = context();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		manager.register([
			plugin("first", "preMessage", async ({ event }) => {
				event.calls.push("first-start");
				await gate;
				event.ready = true;
				event.calls.push("first-end");
			}),
			plugin("second", "preMessage", ({ event }) => {
				event.calls.push(event.ready ? "second-ready" : "second-too-early");
			})
		]);
		const execution = manager.run("preMessage", ctx);
		try {
			expect(ctx.event.calls).toEqual(["first-start"]);
		} finally {
			release();
		}
		expect(await execution).toEqual({ count: 2, successCount: 2 });
		expect(ctx.event.calls).toEqual(["first-start", "first-end", "second-ready"]);
	});

	it("accumulates registrations while running only the requested hook", async () => {
		const manager = new HookManager();
		manager.register([
			{
				name: "multi-hook",
				module: {
					hookNameList: ["preMessage", "postMessage"],
					preMessage: ({ event }: HookContext) => event.calls.push("pre"),
					postMessage: ({ event }: HookContext) => event.calls.push("post")
				}
			}
		]);
		manager.register([
			plugin("later", "preMessage", ({ event }) => {
				event.calls.push("later");
			})
		]);
		const ctx = context();
		expect(await manager.run("preMessage", ctx)).toEqual({ count: 2, successCount: 2 });
		expect(ctx.event.calls).toEqual(["pre", "later"]);
		expect(await manager.run("postMessage", ctx)).toEqual({ count: 1, successCount: 1 });
		expect(ctx.event.calls).toEqual(["pre", "later", "post"]);
		expect(await manager.run("postStart", ctx)).toEqual({ count: 0, successCount: 0 });
	});

	it("isolates synchronous throws and rejected promises without skipping later handlers", async () => {
		const manager = new HookManager();
		const syncError = new Error("sync failure");
		const asyncError = new Error("async failure");
		manager.register([
			plugin("before", "preStart", ({ event }) => {
				event.calls.push("before");
			}),
			plugin("sync-failure", "preStart", ({ event }) => {
				event.calls.push("sync-failure");
				throw syncError;
			}),
			plugin("async-failure", "preStart", async ({ event }) => {
				event.calls.push("async-failure");
				await Promise.resolve();
				throw asyncError;
			}),
			plugin("after", "preStart", ({ event }) => {
				event.calls.push("after");
			})
		]);
		const ctx = context();
		expect(await manager.run("preStart", ctx)).toEqual({ count: 4, successCount: 2 });
		expect(ctx.event.calls).toEqual(["before", "sync-failure", "async-failure", "after"]);
		expect(vi.mocked(Logger.prototype.error).mock.calls.map((call) => call[1])).toEqual([syncError, asyncError]);
	});

	it("starts each run with fresh counts and retains handlers after a failure", async () => {
		const manager = new HookManager();
		let attempts = 0;
		manager.register([
			plugin("recovering", "postStart", () => {
				attempts += 1;
				if (attempts === 1) throw new Error("first attempt failed");
			})
		]);
		expect(await manager.run("postStart", context())).toEqual({ count: 1, successCount: 0 });
		expect(await manager.run("postStart", context())).toEqual({ count: 1, successCount: 1 });
		expect(attempts).toBe(2);
	});

	it("keeps duplicate-name handlers and gives their log output distinct identities across registrations", async () => {
		const manager = new HookManager();
		const observed: string[] = [];
		manager.register([
			plugin("shared", "preStart", (_ctx, log) => {
				observed.push("original");
				log.info("handler-output");
			})
		]);
		manager.register([
			plugin("shared", "preStart", (_ctx, log) => {
				observed.push("duplicate");
				log.info("handler-output");
			})
		]);
		expect(await manager.run("preStart", context())).toEqual({ count: 2, successCount: 2 });
		expect(observed).toEqual(["original", "duplicate"]);
		const tags = vi
			.mocked(console.info)
			.mock.calls.filter((call) => call.includes("handler-output"))
			.map((call) => call[0]);
		expect(tags).toEqual([expect.stringContaining("shared"), expect.stringContaining("shared-ABCD")]);
		expect(tags[0]).not.toEqual(tags[1]);
		expect(Logger.prototype.warn).toHaveBeenCalledTimes(1);
	});

	it("keeps independent managers isolated, including their registered names", async () => {
		const first = new HookManager();
		const second = new HookManager();
		first.register([
			plugin("shared", "preStart", ({ event }) => {
				event.calls.push("first");
			})
		]);
		second.register([
			plugin("shared", "postStart", ({ event }) => {
				event.calls.push("second");
			})
		]);
		const firstContext = context();
		const secondContext = context();
		expect(await first.run("postStart", firstContext)).toEqual({ count: 0, successCount: 0 });
		expect(await second.run("preStart", secondContext)).toEqual({ count: 0, successCount: 0 });
		expect(await first.run("preStart", firstContext)).toEqual({ count: 1, successCount: 1 });
		expect(await second.run("postStart", secondContext)).toEqual({ count: 1, successCount: 1 });
		expect(firstContext.event.calls).toEqual(["first"]);
		expect(secondContext.event.calls).toEqual(["second"]);
		expect(Logger.prototype.warn).not.toHaveBeenCalled();
	});

	it("omits empty-run summaries and includes execution and success counts for nonempty runs", () => {
		const manager = new HookManager();
		const log = new Logger();
		manager.postRun({ count: 0, successCount: 0 }, log);
		expect(Logger.prototype.debug).not.toHaveBeenCalled();
		manager.postRun({ count: 3, successCount: 2 }, log);
		expect(Logger.prototype.debug).toHaveBeenCalledTimes(1);
		expect(vi.mocked(Logger.prototype.debug).mock.calls[0]!.filter((value) => typeof value === "number")).toEqual([
			3, 2
		]);
	});
});
