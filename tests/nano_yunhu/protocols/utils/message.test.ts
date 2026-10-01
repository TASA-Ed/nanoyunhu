import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, PMsg, PMsgSend, PV1 } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel, InferProtoModelInput } from "@saltify/typeproto";
import type { Context } from "#/core/context.ts";
import type { ILogger, TChatTypeValues } from "#/types.ts";
import type { request } from "#/utils/http.ts";
import {
	forwardMessage,
	getMessageById,
	listMessageByMidSeq,
	sendMessage
} from "#/nano_yunhu/protocols/utils/message/message.ts";
import { binaryBody, makeContext, makeLogger, success, transportFailures } from "./fixtures.ts";

const http = vi.hoisted(() => ({ request: vi.fn<typeof request>() }));
vi.mock("#/utils/http.ts", () => ({ request: http.request }));

type MessageData = InferProtoModel<typeof PMsg.ListMessageData>;
type MessageList = InferProtoModel<typeof PMsg.ListMessage>;
type ListInput = InferProtoModelInput<typeof PMsgSend.SendListMessageByMidSeq>;

function messageData(msgId: string, text: string): MessageData {
	return PMsg.ListMessageData.decode(
		PMsg.ListMessageData.encode({
			msgId,
			contentType: 1,
			content: { text },
			sender: { chatId: "sender-1", name: "发送者" },
			sendTimestampMs: 1700000000123n
		})
	);
}

function messageList(data: MessageData[], code: number = 1): MessageList {
	return PMsg.ListMessage.decode(PMsg.ListMessage.encode({ status: { code }, data, total: data.length }));
}

const previous = messageData("previous", "前一条消息");
const target = messageData("target", "目标消息");
const next = messageData("next", "后一条消息");
const query: ListInput = { msgSeq: -1, chatType: 2, chatId: "group-1", msgCount: 1, msgId: "target" };

beforeEach((): void => {
	http.request.mockReset();
});

describe("sendMessage", (): void => {
	it("serializes nested content, a quoted message and a large command ID without precision loss", async (): Promise<void> => {
		const ctx = makeContext();
		const log = makeLogger();
		const send: InferProtoModelInput<typeof PMsgSend.SendMsg> = {
			msgId: "new-message",
			chatId: "group-1",
			chatType: 2,
			contentType: 3,
			data: { text: "**你好** 🌏\n第二行", buttons: '[[{"text":"按钮"}]]' },
			commandId: 9007199254740993n,
			quoteMsgId: "quoted-message"
		};
		const data = PV1.Base.decode(PV1.Base.encode({ status: { code: 1, requestId: 9007199254740995n, msg: "sent" } }));
		http.request.mockResolvedValue(success(data));

		expect(await sendMessage(ctx, send, log)).toEqual(data);
		expect(http.request).toHaveBeenCalledWith(
			`${BASE_URL.v1}msg/send-message`,
			{ method: "POST", headers: { token: "account-token" }, body: expect.any(Buffer) },
			log,
			4321,
			PV1.Base
		);
		expect(PMsgSend.SendMsg.decode(binaryBody(http.request.mock.calls[0]?.[1].body))).toMatchObject(send);
	});

	it.each([0, 2])("rejects protobuf status %i despite HTTP success", async (code: number): Promise<void> => {
		http.request.mockResolvedValue(success(PV1.Base.decode(PV1.Base.encode({ status: { code } }))));
		expect(
			await sendMessage(
				makeContext(),
				{ chatId: "group-1", chatType: 2, data: { text: "hello" }, contentType: 1 },
				makeLogger()
			)
		).toBeUndefined();
	});
});

describe("forwardMessage", (): void => {
	it.each<{ label: string; targets: { chatId: string; chatType: TChatTypeValues }[] }>([
		{
			label: "mixed recipient types",
			targets: [
				{ chatId: "user-1", chatType: 1 },
				{ chatId: "group-1", chatType: 2 },
				{ chatId: "bot-1", chatType: 3 }
			]
		},
		{ label: "an empty recipient list", targets: [] }
	])(
		"serializes $label in the receive field",
		async ({ targets }: { label: string; targets: { chatId: string; chatType: TChatTypeValues }[] }): Promise<void> => {
			const ctx = makeContext();
			const log = makeLogger();
			http.request.mockResolvedValue(success({ code: 1, msg: "forwarded" }));

			expect(await forwardMessage(ctx, 'message-"id', 2, targets, log)).toEqual({ code: 1, msg: "forwarded" });
			expect(http.request).toHaveBeenCalledWith(
				`${BASE_URL.v1}msg/msg-forward`,
				{
					method: "POST",
					headers: { token: "account-token" },
					body: JSON.stringify({ msgId: 'message-"id', chatType: 2, receive: targets })
				},
				log,
				4321
			);
		}
	);

	it.each([0, 2])("rejects JSON business code %i", async (code: number): Promise<void> => {
		http.request.mockResolvedValue(success({ code, msg: "denied" }));
		expect(await forwardMessage(makeContext(), "target", 1, [], makeLogger())).toBeUndefined();
	});

	it("does not expose a structured HTTP failure as a forward result", async (): Promise<void> => {
		http.request.mockResolvedValue({
			success: false,
			kind: "http",
			code: 403,
			error: { code: 403, msg: "denied" },
			mimeType: "application/json"
		});
		expect(await forwardMessage(makeContext(), "target", 1, [], makeLogger())).toBeUndefined();
	});
});

describe("listMessageByMidSeq", (): void => {
	it.each<{ label: string; input: ListInput }>([
		{ label: "message ID with the negative sequence sentinel", input: query },
		{
			label: "sequence zero with a large optional cursor",
			input: { ...query, msgSeq: 0, msgCount: 30, field6: 9007199254740993n }
		}
	])(
		"encodes a query by $label and preserves decoded message content",
		async ({ input }: { label: string; input: ListInput }): Promise<void> => {
			const ctx = makeContext();
			const log = makeLogger();
			const data = messageList([previous, target]);
			http.request.mockResolvedValue(success(data));

			expect(await listMessageByMidSeq(ctx, input, log)).toEqual(data);
			expect(http.request).toHaveBeenCalledWith(
				`${BASE_URL.v1}msg/list-message-by-mid-seq`,
				{ method: "POST", headers: { token: "account-token" }, body: expect.any(Uint8Array) },
				log,
				4321,
				PMsg.ListMessage
			);
			expect(PMsgSend.SendListMessageByMidSeq.decode(binaryBody(http.request.mock.calls[0]?.[1].body))).toMatchObject(
				input
			);
		}
	);

	it("accepts a successful empty history", async (): Promise<void> => {
		http.request.mockResolvedValue(success(messageList([])));
		expect((await listMessageByMidSeq(makeContext(), query, makeLogger()))?.data).toEqual([]);
	});

	it.each([0, 2])(
		"rejects protobuf status %i even if matching messages are present",
		async (code: number): Promise<void> => {
			http.request.mockResolvedValue(success(messageList([previous, target], code)));
			expect(await listMessageByMidSeq(makeContext(), query, makeLogger())).toBeUndefined();
		}
	);
});

const requestOperations: { name: string; invoke: (ctx: Context, log: ILogger) => Promise<unknown> }[] = [
	{
		name: "sendMessage",
		invoke: (ctx: Context, log: ILogger): Promise<unknown> =>
			sendMessage(ctx, { chatId: "group-1", chatType: 2, data: { text: "hello" }, contentType: 1 }, log)
	},
	{
		name: "forwardMessage",
		invoke: (ctx: Context, log: ILogger): Promise<unknown> =>
			forwardMessage(ctx, "target", 2, [{ chatId: "user-1", chatType: 1 }], log)
	},
	{
		name: "listMessageByMidSeq",
		invoke: (ctx: Context, log: ILogger): Promise<unknown> => listMessageByMidSeq(ctx, query, log)
	}
];

describe.each(requestOperations)("$name transport failures", ({ invoke }: (typeof requestOperations)[number]): void => {
	it.each(transportFailures)(
		"returns undefined after $label",
		async ({ response }: (typeof transportFailures)[number]): Promise<void> => {
			http.request.mockResolvedValue(response);
			expect(await invoke(makeContext(), makeLogger())).toBeUndefined();
		}
	);
});

describe("getMessageById", (): void => {
	it.each<{ label: string; data: MessageData[]; expected: MessageData | undefined }>([
		{ label: "the requested second message", data: [previous, target], expected: target },
		{ label: "an empty result", data: [], expected: undefined },
		{ label: "a single matching message", data: [target], expected: undefined },
		{ label: "a matching first message only", data: [target, next], expected: undefined },
		{ label: "a different second message", data: [previous, next], expected: undefined },
		{ label: "three messages with a matching second message", data: [previous, target, next], expected: undefined }
	])(
		"handles $label using the actual list utility",
		async ({
			data,
			expected
		}: {
			label: string;
			data: MessageData[];
			expected: MessageData | undefined;
		}): Promise<void> => {
			const ctx = makeContext({
				listMessageByMidSeq: (send: ListInput, log: ILogger): Promise<MessageList | undefined> =>
					listMessageByMidSeq(ctx, send, log)
			});
			http.request.mockResolvedValue(success(messageList(data)));

			expect(await getMessageById(ctx, "target", 2, "group-1", makeLogger())).toEqual(expected);
			expect(PMsgSend.SendListMessageByMidSeq.decode(binaryBody(http.request.mock.calls[0]?.[1].body))).toMatchObject(
				query
			);
		}
	);

	it("returns undefined when the history request fails", async (): Promise<void> => {
		const ctx = makeContext({
			listMessageByMidSeq: (send: ListInput, log: ILogger): Promise<MessageList | undefined> =>
				listMessageByMidSeq(ctx, send, log)
		});
		http.request.mockResolvedValue(success(messageList([previous, target], 2)));
		expect(await getMessageById(ctx, "target", 2, "group-1", makeLogger())).toBeUndefined();
	});
});
