import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pluginStatus } from "#/plugin/internal/status.ts";
import { formatTimestampDiff } from "#/utils/time.ts";
import type { HookContext } from "#/plugin/types.ts";
import type { ILogger } from "#/types.ts";

const now = new Date("2026-05-01T12:00:00.123Z");
const started = new Date("2026-05-01T10:57:55.789Z");

function fixture(event: HookContext["event"]) {
	const log: ILogger = {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn<ILogger["child"]>(),
		level: "info"
	};
	const sendMessage = vi.fn().mockResolvedValue({ status: { code: 1 } });
	const utils = {
		getSystemInfo: vi.fn(() => ({ type: "test-os", release: "6.1", arch: "x64" })),
		generateMsgID: vi.fn(() => "generated-message-id"),
		formatTimestampDiff
	};
	const ctx = {
		appName: "test-app",
		appVersion: "1.2.3",
		startTimestamp: started,
		utils,
		protocol: { sendMessage }
	};
	const hookContext: HookContext = { ctx: ctx as unknown as HookContext["ctx"], event };
	return { hookContext, log, sendMessage, utils };
}

function command(chatId = "chat-1", chatType = 1): HookContext["event"] {
	return { msg: { data: { value: { chatId, chatType, content: { text: "#nanoyunhu" } } } } };
}

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(now);
});

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("pluginStatus", () => {
	it.each([
		{ label: "missing message", event: {} },
		{ label: "null message", event: { msg: null } },
		{ label: "missing message data", event: { msg: {} } },
		{ label: "missing message value", event: { msg: { data: {} } } },
		{ label: "missing content", event: { msg: { data: { value: {} } } } },
		{ label: "null content", event: { msg: { data: { value: { content: null } } } } },
		{ label: "different text", event: { msg: { data: { value: { content: { text: "hello" } } } } } },
		{
			label: "command with trailing whitespace",
			event: { msg: { data: { value: { content: { text: "#nanoyunhu " } } } } }
		},
		{ label: "non-string text", event: { msg: { data: { value: { content: { text: 42 } } } } } }
	])("ignores $label without collecting system information or sending", async ({ event }) => {
		const { hookContext, log, sendMessage, utils } = fixture(event);
		await pluginStatus(hookContext, log);
		expect(utils.getSystemInfo).not.toHaveBeenCalled();
		expect(utils.generateMsgID).not.toHaveBeenCalled();
		expect(sendMessage).not.toHaveBeenCalled();
		expect(log.warn).not.toHaveBeenCalled();
	});

	it.each([
		{ chatId: "direct-chat", chatType: 1 },
		{ chatId: "group-chat", chatType: 2 }
	])(
		"builds a status reply for chat type $chatType with runtime metadata and second-rounded uptime",
		async ({ chatId, chatType }) => {
			const { hookContext, log, sendMessage } = fixture(command(chatId, chatType));
			await pluginStatus(hookContext, log);
			expect(sendMessage).toHaveBeenCalledTimes(1);
			const message = sendMessage.mock.calls[0]![0];
			expect(message).toEqual({
				msgId: "generated-message-id",
				chatId,
				chatType,
				contentType: 1,
				data: { text: expect.any(String) }
			});
			expect(message.data.text).toContain("test-app");
			expect(message.data.text).toContain("1.2.3");
			expect(message.data.text).toContain("test-os 6.1 (x64)");
			const uptime = formatTimestampDiff(Math.floor(started.getTime() / 1000), Math.floor(now.getTime() / 1000));
			expect(message.data.text).toContain(uptime);
			expect(log.warn).not.toHaveBeenCalled();
		}
	);

	it("awaits delivery and warns with the attempted message only after a failed response", async () => {
		const { hookContext, log, sendMessage } = fixture(command());
		let finishDelivery!: () => void;
		const delivery = new Promise<undefined>((resolve) => {
			finishDelivery = () => resolve(undefined);
		});
		sendMessage.mockReturnValue(delivery);
		let completed = false;
		const execution = pluginStatus(hookContext, log).then(() => {
			completed = true;
		});
		try {
			await Promise.resolve();
			expect(completed).toBe(false);
			expect(log.warn).not.toHaveBeenCalled();
		} finally {
			finishDelivery();
			await execution;
		}
		expect(completed).toBe(true);
		expect(log.warn).toHaveBeenCalledTimes(1);
		expect(vi.mocked(log.warn).mock.calls[0]![1]).toBe(sendMessage.mock.calls[0]![0]);
	});

	it("propagates protocol rejections instead of reporting a completed delivery", async () => {
		const { hookContext, log, sendMessage } = fixture(command());
		const failure = new Error("delivery rejected");
		sendMessage.mockRejectedValue(failure);
		await expect(pluginStatus(hookContext, log)).rejects.toBe(failure);
		expect(log.warn).not.toHaveBeenCalled();
	});

	it("does not send a partial status response if system information cannot be collected", async () => {
		const { hookContext, log, sendMessage, utils } = fixture(command());
		const failure = new Error("system information unavailable");
		utils.getSystemInfo.mockImplementation(() => {
			throw failure;
		});
		await expect(pluginStatus(hookContext, log)).rejects.toBe(failure);
		expect(sendMessage).not.toHaveBeenCalled();
		expect(utils.generateMsgID).not.toHaveBeenCalled();
	});
});
