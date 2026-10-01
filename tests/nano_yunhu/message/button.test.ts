import { describe, expect, it, vi } from "vitest";
import { parseButton } from "#/nano_yunhu/message/button.ts";
import type { ILogger } from "#/types.ts";

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

describe("parseButton", (): void => {
	it.each(["[]", "", " \n\t", "null"])("treats %j as no buttons", (input: string): void => {
		const log = logger();
		expect(parseButton(input, log)).toBeUndefined();
		expect(log.error).not.toHaveBeenCalled();
	});

	it("decodes nested action JSON while preserving row order and non-JSON values", (): void => {
		const log = logger();
		const rows = [
			[
				{ text: "action", value: '{"id":"42","type":1}' },
				{ text: "empty", value: " " }
			],
			[
				{ text: "null", value: "null" },
				{ text: "object", value: { id: "43" } }
			]
		];
		expect(parseButton(JSON.stringify(rows), log)).toEqual([
			[
				{ text: "action", value: { id: "42", type: 1 } },
				{ text: "empty", value: " " }
			],
			rows[1]
		]);
		expect(log.error).not.toHaveBeenCalled();
	});

	it("retains an invalid action without discarding valid neighboring buttons", (): void => {
		const log = logger();
		expect(parseButton('[[{"text":"bad","value":"broken"},{"text":"good","value":"{\\"id\\":1}"}]]', log)).toEqual([
			[
				{ text: "bad", value: "broken" },
				{ text: "good", value: { id: 1 } }
			]
		]);
		expect(log.error).toHaveBeenCalledWith("解析按钮 value 失败:", "broken");
	});

	it.each(["{", "{}", "[{}]", "[null]"])("rejects malformed rows %j", (input: string): void => {
		const log = logger();
		expect(parseButton(input, log)).toBeUndefined();
		expect(log.error).toHaveBeenCalledWith("解析按钮失败:", input);
	});
});
