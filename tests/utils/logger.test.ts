import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TLogLevel } from "#/types.ts";

beforeEach(() => {
	// Reload the module to isolate initLogger's process-wide state between test cases.
	vi.resetModules();
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function advancedLogger(options: { maxDepth?: number; colorize?: boolean } = {}) {
	const { Logger, initLogger } = await import("#/utils/logger.ts");
	initLogger({ locale: "en-US", level: "trace", colorize: options.colorize ?? false });
	const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	const logger = new Logger({ timestamp: false, ...options });
	return { logger, stdout, stderr };
}

describe("Logger filtering and configuration", () => {
	it.each(["trace", "debug", "info", "warn", "error"] as const)(
		"filters below %s and routes accepted levels",
		async (threshold) => {
			const { Logger } = await import("#/utils/logger.ts");
			const methods = {
				trace: vi.spyOn(console, "log").mockImplementation(() => {}),
				debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
				info: vi.spyOn(console, "info").mockImplementation(() => {}),
				warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
				error: vi.spyOn(console, "error").mockImplementation(() => {})
			};
			const levels: TLogLevel[] = ["trace", "debug", "info", "warn", "error"];
			const logger = new Logger({ level: threshold });
			for (const level of levels) {
				logger[level]("payload");
				expect(methods[level]).toHaveBeenCalledTimes(levels.indexOf(level) >= levels.indexOf(threshold) ? 1 : 0);
			}
		}
	);

	it("updates existing instances when global configuration changes", async () => {
		const { Logger, initLogger } = await import("#/utils/logger.ts");
		const logger = new Logger({ level: "error", timestamp: false, colorize: true });
		const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
		vi.spyOn(console, "warn").mockImplementation(() => {});
		initLogger({ locale: "en-US", level: "debug", colorize: false });
		expect(logger.level).toBe("debug");
		logger.debug("visible");
		expect(stdout).toHaveBeenCalledWith(expect.stringContaining("visible"));
		expect(String(stdout.mock.calls[0][0])).not.toContain("\u001b[");
		initLogger({ locale: "en-US", level: "error", colorize: false });
		logger.warn("hidden");
		expect(logger.level).toBe("error");
		expect(stdout).toHaveBeenCalledTimes(1);
	});

	it("applies changed instance levels and inherited child filtering", async () => {
		const { Logger } = await import("#/utils/logger.ts");
		const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
		const logger = new Logger({ prefix: "parent", level: "error" });
		logger.level = "debug";
		const child = logger.child("child");
		child.debug("visible");
		expect(debug).toHaveBeenCalledWith(expect.stringContaining("parent:child"), "visible");
	});
});

describe("Logger serialization", () => {
	it("routes errors to stderr and other messages to stdout", async () => {
		const { logger, stdout, stderr } = await advancedLogger();
		logger.warn("warning payload");
		logger.error("error payload");
		expect(stdout).toHaveBeenCalledTimes(1);
		expect(stdout).toHaveBeenCalledWith(expect.stringContaining("warning payload"));
		expect(stderr).toHaveBeenCalledTimes(1);
		expect(stderr).toHaveBeenCalledWith(expect.stringContaining("error payload"));
	});

	it("distinguishes cycles from shared references", async () => {
		const { logger, stdout } = await advancedLogger();
		const shared = { value: "shared" };
		const cyclic: { self?: unknown } = {};
		cyclic.self = cyclic;
		logger.info({ first: shared, second: shared, cyclic });
		const output = String(stdout.mock.calls[0][0]);
		expect(output.match(/\[Circular\]/g)).toHaveLength(1);
		expect(output.match(/"shared"/g)).toHaveLength(2);
	});

	it("bounds nested serialization without hiding sibling primitives", async () => {
		const { logger, stdout } = await advancedLogger({ maxDepth: 1 });
		logger.info({ nested: { secret: "hidden" }, visible: 42 });
		const output = String(stdout.mock.calls[0][0]);
		expect(output).toContain("[MaxDepth]");
		expect(output).not.toContain("hidden");
		expect(output).toContain("42");
	});

	it("retains error causes and custom properties", async () => {
		const { logger, stderr } = await advancedLogger();
		const error = Object.assign(new Error("outer", { cause: new TypeError("inner") }), { code: "E_TEST" });
		logger.error(error);
		const output = String(stderr.mock.calls[0][0]);
		for (const value of ["outer", "inner", "TypeError", "cause", "E_TEST"]) expect(output).toContain(value);
	});

	it("preserves values in collections and symbol-keyed properties", async () => {
		const { logger, stdout } = await advancedLogger();
		logger.info(
			new Map([["key", 42]]),
			new Set(["member"]),
			{ [Symbol("tag")]: 17n },
			Buffer.from([1, 2]),
			new Date("2026-01-01T00:00:00Z")
		);
		const output = String(stdout.mock.calls[0][0]);
		for (const value of ["key", "42", "member", "Symbol(tag)", "17n", "Buffer(2)", "2026-01-01T00:00:00.000Z"])
			expect(output).toContain(value);
	});

	it("can enable ANSI colors globally", async () => {
		const { logger, stdout } = await advancedLogger({ colorize: true });
		logger.info("colored");
		expect(String(stdout.mock.calls[0][0])).toContain("\u001b[");
	});
});
