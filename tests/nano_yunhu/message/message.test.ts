import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "#/core/context.ts";
import type { ILogger } from "#/types.ts";
import { pushMessage, wssClientMessage } from "#/nano_yunhu/message/message.ts";
import type { HookExecutionResults } from "#/plugin/manager.ts";

vi.mock("#/nano_yunhu/cached/cached.ts", (): object => ({ getGroupName: (): string => "测试群" }));
vi.mock("#/nano_yunhu/message/persistence.ts", (): object => ({ saveMessage: vi.fn() }));
const log: ILogger = {
	trace: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	child: vi.fn<ILogger["child"]>(),
	level: "info"
};
const run = vi.fn<Context["pluginManager"]["run"]>();
const postRun = vi.fn<Context["pluginManager"]["postRun"]>();
const ctx = { pluginManager: { run, postRun } } as unknown as Context;
type Message = Parameters<typeof pushMessage>[1];
function message(contentType: number, content: object, chatType: number = 1): Message {
	return {
		data: {
			value: {
				chatType,
				chatId: "chat",
				sender: { name: "sender", chatId: "sender-id" },
				contentType,
				content: { buttons: "[]", ...content }
			}
		}
	} as Message;
}
beforeEach((): void => {
	vi.clearAllMocks();
	run.mockResolvedValue({ count: 0, successCount: 0 });
});
describe("pushMessage", (): void => {
	it.each([
		[1, { text: "hello" }, "hello"],
		[2, { imageUrl: "image" }, "image"],
		[3, { text: "markdown" }, "markdown"],
		[4, { fileName: "file", fileUrl: "url" }, "file url"],
		[6, { postTitle: "title", postId: "id" }, "title id"],
		[7, { imageId: "sticker" }, "https://chat-img.jwznb.com/sticker"],
		[8, { text: "html" }, "html"],
		[10, { videoUrl: "video" }, "video"],
		[11, { audioUrl: "audio" }, "audio"],
		[13, { callStatusText: "ended" }, "ended"],
		[14, { text: "a2ui" }, "a2ui"],
		[999, { text: "unknown" }, "unknown"]
	] as const)("renders message content type %i", (type: number, content: object, expected: string): void => {
		pushMessage(ctx, message(type, content), log);
		expect(log.info).toHaveBeenCalledWith(
			"[sender(chat)]",
			"[sender(sender-id)]",
			type === 999 ? "[未知消息]" : expect.any(String),
			expected
		);
	});
	it.each([1, 3, 8, 14, 999])("limits textual content type %i at the 300-character boundary", (type: number): void => {
		pushMessage(ctx, message(type, { text: "x".repeat(300) }), log);
		expect(log.info).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			"x".repeat(300)
		);
		pushMessage(ctx, message(type, { text: "x".repeat(301) }), log);
		expect(log.info).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.any(String),
			expect.any(String),
			"x".repeat(294) + "......"
		);
	});
	it("renders cached group identity and button rows", (): void => {
		pushMessage(
			ctx,
			message(
				1,
				{
					text: "hello",
					buttons: JSON.stringify([
						[
							{ text: "A", value: "" },
							{ text: "B", value: "" }
						],
						[{ text: "C", value: "" }]
					])
				},
				2
			),
			log
		);
		expect(log.info).toHaveBeenCalledWith(
			"[测试群(chat)]",
			"[sender(sender-id)]",
			"[文本消息]",
			"hello",
			"按钮列表：A,B | C"
		);
	});
	it("still renders content when buttons are malformed", (): void => {
		pushMessage(ctx, message(1, { text: "hello", buttons: "{" }), log);
		expect(log.info).toHaveBeenCalledWith("[sender(chat)]", "[sender(sender-id)]", "[文本消息]", "hello");
		expect(log.error).toHaveBeenCalledWith("解析按钮失败:", "{");
	});
	it("dispatches lifecycle events and handles asynchronous plugin results", async (): Promise<void> => {
		const { promise, resolve } = Promise.withResolvers<HookExecutionResults>();
		run.mockReturnValue(promise);
		const msg = message(1, { text: "hello" });
		pushMessage(ctx, msg, log);
		expect(run.mock.calls).toEqual([
			["preMessage", { ctx, event: { msg } }],
			["postMessage", { ctx, event: { msg } }]
		]);
		expect(postRun).not.toHaveBeenCalled();
		resolve({ count: 2, successCount: 1 });
		await promise;
		expect(postRun.mock.calls).toEqual([
			[{ count: 2, successCount: 1 }, log],
			[{ count: 2, successCount: 1 }, log]
		]);
	});
});
describe("wssClientMessage", (): void => {
	it("ignores absent and unrelated command types without accessing message data", (): void => {
		wssClientMessage(ctx, undefined, false);
		wssClientMessage(ctx, undefined, "draft_input" as Parameters<typeof wssClientMessage>[2]);
		expect(run).not.toHaveBeenCalled();
	});
});
