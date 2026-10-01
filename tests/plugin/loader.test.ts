import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPluginsFromDir } from "#/plugin/loader.ts";
import { HookManager } from "#/plugin/manager.ts";
import { HOOK_NAMES } from "#/plugin/types.ts";
import type { HookContext } from "#/plugin/types.ts";
import { Logger } from "#/utils/logger.ts";

let directory: string;

async function fixture(name: string, source: string): Promise<void> {
	await writeFile(path.join(directory, name), source, "utf8");
}

beforeEach(async () => {
	directory = await mkdtemp(path.join(tmpdir(), "nanoyunhu-plugin-"));
	await fixture("package.json", JSON.stringify({ type: "module" }));
	vi.spyOn(Logger.prototype, "debug").mockImplementation(() => {});
	vi.spyOn(Logger.prototype, "info").mockImplementation(() => {});
	vi.spyOn(Logger.prototype, "error").mockImplementation(() => {});
});

afterEach(async () => {
	try {
		await rm(directory, { recursive: true, force: true });
	} finally {
		vi.restoreAllMocks();
	}
});

describe("loadPluginsFromDir", () => {
	it("loads real .js and .mjs modules and runs every supported hook", async () => {
		await fixture(
			"named.js",
			`export const name = "explicit-name";
export const hookNameList = ${JSON.stringify(HOOK_NAMES)};
${HOOK_NAMES.map((hook) => `export function ${hook}({ event }) { event.calls.push("${hook}"); }`).join("\n")}`
		);
		await fixture(
			"fallback.mjs",
			'export const hookNameList = ["preMessage"]; export function preMessage({ event }) { event.calls.push("fallback"); }'
		);
		const loaded = await loadPluginsFromDir(directory);
		expect(loaded.map((plugin) => plugin.name).sort()).toEqual(["explicit-name", "fallback"]);
		expect(Logger.prototype.error).not.toHaveBeenCalled();

		const named = loaded.find((plugin) => plugin.name === "explicit-name")!;
		const manager = new HookManager();
		manager.register([named]);
		const event = { calls: [] as string[] };
		const context = { ctx: {} as HookContext["ctx"], event };
		for (const hook of HOOK_NAMES) {
			expect(await manager.run(hook, context)).toEqual({ count: 1, successCount: 1 });
		}
		expect(event.calls).toEqual([...HOOK_NAMES]);

		const fallbackManager = new HookManager();
		fallbackManager.register(loaded.filter((plugin) => plugin.name === "fallback"));
		expect(await fallbackManager.run("preMessage", context)).toEqual({ count: 1, successCount: 1 });
		expect(event.calls).toEqual([...HOOK_NAMES, "fallback"]);
	});

	it("accepts an empty hook list without requiring hook exports", async () => {
		await fixture("inactive.mjs", 'export const name = "inactive"; export const hookNameList = [];');
		const loaded = await loadPluginsFromDir(directory);
		expect(loaded.map((plugin) => plugin.name)).toEqual(["inactive"]);
		const manager = new HookManager();
		manager.register(loaded);
		expect(await manager.run("preStart", { ctx: {} as HookContext["ctx"], event: {} })).toEqual({
			count: 0,
			successCount: 0
		});
		expect(Logger.prototype.error).not.toHaveBeenCalled();
	});

	it.each([
		{ reason: "missing hook list", source: 'export const name = "invalid";' },
		{ reason: "non-array hook list", source: 'export const hookNameList = "preStart"; export function preStart() {}' },
		{ reason: "unknown hook", source: 'export const hookNameList = ["unknown"]; export function unknown() {}' },
		{ reason: "missing declared function", source: 'export const hookNameList = ["preStart"];' },
		{ reason: "non-function hook", source: 'export const hookNameList = ["preStart"]; export const preStart = 42;' },
		{
			reason: "a later invalid hook after a valid one",
			source: 'export const hookNameList = ["preStart", "unknown"]; export function preStart() {}'
		},
		{ reason: "module initialization failure", source: 'throw new Error("fixture initialization failed");' },
		{
			reason: "missing imported dependency",
			source: 'import "./absent-dependency.mjs"; export const hookNameList = [];'
		}
	])("isolates $reason and continues loading valid modules", async ({ source }) => {
		await fixture("broken.mjs", source);
		await fixture("working.mjs", 'export const hookNameList = ["postStart"]; export function postStart() {}');
		const loaded = await loadPluginsFromDir(directory);
		expect(loaded.map((plugin) => plugin.name)).toEqual(["working"]);
		expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
		const error = vi.mocked(Logger.prototype.error).mock.calls[0]![1];
		expect(error).toBeInstanceOf(Error);
	});

	it("ignores unsupported file extensions without importing them", async () => {
		for (const extension of ["ts", "cjs", "txt"]) {
			await fixture(`ignored.${extension}`, 'throw new Error("unsupported file was imported");');
		}
		expect(await loadPluginsFromDir(directory)).toEqual([]);
		expect(Logger.prototype.error).not.toHaveBeenCalled();
	});

	it("returns no plugins for an empty directory", async () => {
		expect(await loadPluginsFromDir(directory)).toEqual([]);
		expect(Logger.prototype.error).not.toHaveBeenCalled();
	});

	it("rejects an unreadable directory instead of treating it as an empty plugin collection", async () => {
		await expect(loadPluginsFromDir(path.join(directory, "missing"))).rejects.toMatchObject({ code: "ENOENT" });
		expect(Logger.prototype.error).not.toHaveBeenCalled();
	});
});
