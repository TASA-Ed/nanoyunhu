import { afterEach, describe, expect, it, vi } from "vitest";
import {
	generateInt,
	generateMsgID,
	generateString,
	generateUUIDv4,
	generateUUIDv7,
	generateWssSeq
} from "#/utils/generate.ts";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("generated identifiers", () => {
	it.each([
		{ generate: generateUUIDv4, version: "4" },
		{ generate: generateUUIDv7, version: "7" }
	])("produces an RFC UUID with version $version", ({ generate, version }) => {
		expect(generate()).toMatch(
			new RegExp(`^[0-9a-f]{8}-[0-9a-f]{4}-${version}[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
		);
	});

	it("embeds the current base-36 timestamp and a 16-byte random suffix in WebSocket sequences", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_800_000_000_000);
		expect(generateWssSeq()).toMatch(/^nano-mywpiww0-[0-9a-f]{32}$/);
	});

	it("produces a 16-byte hexadecimal message identifier", () => {
		expect(generateMsgID()).toMatch(/^[0-9a-f]{32}$/);
	});
});

describe("generateString", () => {
	it.each([1, 5, 32])("encodes %s requested bytes as hex", (length) => {
		expect(generateString(length)).toMatch(new RegExp(`^[0-9a-f]{${length * 2}}$`));
	});

	it("allows an empty random string", () => {
		expect(generateString(0)).toBe("");
	});

	it("rejects a negative byte count", () => {
		expect(() => generateString(-1)).toThrow(RangeError);
	});
});

describe("generateInt", () => {
	it.each([-7, 0, 12])("supports the single-value half-open interval starting at %s", (min) => {
		expect(generateInt(min, min + 1)).toBe(min);
	});

	it.each([
		{ min: 5, max: 5, error: RangeError },
		{ min: 6, max: 5, error: RangeError },
		{ min: 0.5, max: 2, error: TypeError },
		{ min: 0, max: 2.5, error: TypeError }
	])("rejects invalid bounds $min, $max", ({ min, max, error }) => {
		expect(() => generateInt(min, max)).toThrow(error);
	});
});
