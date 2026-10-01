import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "#/core/context.ts";
import type { ILogger } from "#/types.ts";
import { saveMessage } from "#/nano_yunhu/message/persistence.ts";

const ctx = { accountData: { userId: "self" } } as unknown as Context;
const log: ILogger = {
	trace: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	child: vi.fn<ILogger["child"]>(),
	level: "info"
};
type Message = Parameters<typeof saveMessage>[1];
let root: string;
function message(chatId: string, chatType: number, senderType: number = 1): Message {
	return {
		data: {
			value: { chatId, chatType, sender: { chatId: "sender", chatType: senderType }, msgId: "message", sendTime: 123n }
		}
	} as unknown as Message;
}
function path(type: string, id: string): string {
	return join(root, "Nano_Yunhu", "Chats", type, id, "msg.json");
}
beforeEach((): void => {
	root = mkdtempSync(join(tmpdir(), "nanoyunhu-message-"));
	vi.spyOn(process, "cwd").mockReturnValue(root);
	vi.clearAllMocks();
});
afterEach((): void => {
	vi.restoreAllMocks();
	rmSync(root, { recursive: true, force: true });
});
describe("saveMessage", (): void => {
	it.each([
		[1, "User"],
		[2, "Group"],
		[3, "Bot"],
		[99, "Unknown"]
	] as const)("persists chat type %i under %s and appends messages", (type: number, directory: string): void => {
		const first = message("chat", type);
		const second = { data: { value: { ...first.data.value, msgId: "second" } } } as Message;
		saveMessage(ctx, first, log);
		saveMessage(ctx, second, log);
		const expected = JSON.parse(
			JSON.stringify([first.data.value, second.data.value], (_key: string, value: unknown): unknown =>
				typeof value === "bigint" ? String(value) : value
			)
		);
		expect(JSON.parse(readFileSync(path(directory, "chat"), "utf8"))).toEqual(expected);
		expect(log.error).not.toHaveBeenCalled();
	});
	it.each([
		[1, "User"],
		[3, "Bot"]
	] as const)("routes incoming private messages to sender type %i", (type: number, directory: string): void => {
		const msg = message("self", 1, type);
		saveMessage(ctx, msg, log);
		expect(JSON.parse(readFileSync(path(directory, "sender"), "utf8"))[0].chatId).toBe("self");
	});
	it("stores incomplete envelopes in the unknown bucket", (): void => {
		saveMessage(ctx, {} as Message, log);
		expect(JSON.parse(readFileSync(path("Unknown", "0"), "utf8"))).toEqual([null]);
	});
	it("preserves a corrupt file instead of overwriting message history", (): void => {
		const file = path("Group", "chat");
		mkdirSync(join(file, ".."), { recursive: true });
		writeFileSync(file, "not json");
		saveMessage(ctx, message("chat", 2), log);
		expect(readFileSync(file, "utf8")).toBe("not json");
		expect(log.error).toHaveBeenCalledWith("Failed to save persistent file:", expect.any(Error));
	});
	it("reports directory creation failure without throwing", (): void => {
		writeFileSync(join(root, "Nano_Yunhu"), "blocking file");
		saveMessage(ctx, message("chat", 2), log);
		expect(log.error).toHaveBeenCalledWith("Failed to create persistent file:", expect.any(Error));
		expect(readFileSync(join(root, "Nano_Yunhu"), "utf8")).toBe("blocking file");
	});
});
