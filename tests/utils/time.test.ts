import { describe, expect, it } from "vitest";
import { formatTimestampDiff } from "#/utils/time.ts";

describe("formatTimestampDiff", () => {
	it.each([
		[0, "0 时 0 分 0 秒"],
		[59, "0 时 0 分 59 秒"],
		[60, "0 时 1 分 0 秒"],
		[3599, "0 时 59 分 59 秒"],
		[3600, "1 时 0 分 0 秒"],
		[3661, "1 时 1 分 1 秒"],
		[90061, "25 时 1 分 1 秒"],
		[61.5, "0 时 1 分 1.5 秒"]
	] as const)("formats a %s-second difference", (difference, expected) => {
		expect(formatTimestampDiff(100, 100 + difference)).toBe(expected);
	});

	it("uses the absolute difference even across zero", () => {
		expect(formatTimestampDiff(-30, 31)).toBe("0 时 1 分 1 秒");
		expect(formatTimestampDiff(31, -30)).toBe("0 时 1 分 1 秒");
	});
});
