import { Logger } from "#/utils/logger.ts";
import type { ILogger } from "#/types.ts";
import type { PWss } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel } from "@saltify/typeproto";
import { getGroupName } from "../cached/cached.ts";
import { parseButton } from "./button.ts";
import { saveMessage } from "./persistence.ts";
import type { Context } from "#/core/context.ts";

const log = new Logger({ prefix: "Message" });

export const MESSAGE_TYPE_ENUM = {
	// 文本消息！
	TEXT: 1,
	// 图片消息
	IMAGE: 2,
	// Markdown 消息！
	MARKDOWN: 3,
	// 文件消息
	FILE: 4,
	// 帖子消息
	POST: 6,
	// 表情消息
	STICKER: 7,
	// HTML 消息
	HTML: 8,
	// 视频消息
	VIDEO: 10,
	// 语音消息
	AUDIO: 11,
	// 语音通话
	CALL: 13,
	// A2UI 消息
	A2UI: 14
} as const satisfies Record<string, number>;

export type TMessageTypeValues = (typeof MESSAGE_TYPE_ENUM)[keyof typeof MESSAGE_TYPE_ENUM];

export const MESSAGE_TYPE_TEXT = {
	[MESSAGE_TYPE_ENUM.TEXT]: "文本消息",
	[MESSAGE_TYPE_ENUM.IMAGE]: "图片消息",
	[MESSAGE_TYPE_ENUM.MARKDOWN]: "Markdown 消息",
	[MESSAGE_TYPE_ENUM.FILE]: "Markdown 消息",
	[MESSAGE_TYPE_ENUM.POST]: "帖子消息",
	[MESSAGE_TYPE_ENUM.STICKER]: "表情消息",
	[MESSAGE_TYPE_ENUM.HTML]: "HTML 消息",
	[MESSAGE_TYPE_ENUM.VIDEO]: "视频消息",
	[MESSAGE_TYPE_ENUM.AUDIO]: "语音消息",
	[MESSAGE_TYPE_ENUM.CALL]: "语音通话消息",
	[MESSAGE_TYPE_ENUM.A2UI]: "A2UI 消息"
} as const satisfies Record<TMessageTypeValues, string>;

export function wssClientMessage(ctx: Context, data: unknown, type: PWss.CmdMap | false): void {
	if (!type) return;
	if (type?.includes("push_message")) {
		pushMessage(ctx, data as InferProtoModel<typeof PWss.PushMessage>, log);
		saveMessage(ctx, data as InferProtoModel<typeof PWss.PushMessage>, log);
	} else if (type?.includes("draft_input")) {
	} else if (type?.includes("file_send_message")) {
	} else if (type?.includes("edit_message")) {
	} else if (type?.includes("invite_apply")) {
	}
}

export function pushMessage(ctx: Context, msg: InferProtoModel<typeof PWss.PushMessage>, log: ILogger): void {
	const chat = `[${msg?.data?.value?.chatType == 2 ? getGroupName(ctx, msg?.data?.value?.chatId) : msg?.data?.value?.sender?.name}(${msg?.data?.value?.chatId})]`;
	const sender = `[${msg?.data?.value?.sender?.name}(${msg?.data?.value?.sender?.chatId})]`;
	const { msgTypeText, msgContentText } = messageLog(msg?.data?.value?.contentType, msg?.data?.value?.content);
	ctx.pluginManager.run("preMessage", { ctx, event: { msg } }).then((result) => ctx.pluginManager.postRun(result, log));
	const button = parseButton(msg?.data?.value?.content?.buttons, log);
	if (!button) {
		log.info(chat, sender, msgTypeText, msgContentText);
	} else {
		log.info(
			chat,
			sender,
			msgTypeText,
			msgContentText,
			`按钮列表：${button
				.map((row) =>
					row.map((item) => {
						return item.text;
					})
				)
				.join(" | ")}`
		);
	}
	ctx.pluginManager
		.run("postMessage", { ctx, event: { msg } })
		.then((result) => ctx.pluginManager.postRun(result, log));
}

function messageLog(
	msgType: number,
	msgContent: InferProtoModel<typeof PWss.PushMessageContent>
): { msgTypeText: string; msgContentText: string } {
	const messageTypeText = MESSAGE_TYPE_TEXT[msgType];
	let msgTypeText: string = !messageTypeText ? "[未知消息]" : `[${messageTypeText}]`;
	let msgContentText: string;
	switch (msgType) {
		case MESSAGE_TYPE_ENUM.TEXT:
			msgContentText = contentLimit(msgContent.text);
			break;
		case MESSAGE_TYPE_ENUM.IMAGE:
			msgContentText = msgContent.imageUrl;
			break;
		case MESSAGE_TYPE_ENUM.MARKDOWN:
			msgContentText = contentLimit(msgContent.text);
			break;
		case MESSAGE_TYPE_ENUM.FILE:
			msgContentText = `${msgContent.fileName} ${msgContent.fileUrl}`;
			break;
		case MESSAGE_TYPE_ENUM.POST:
			msgContentText = `${msgContent.postTitle} ${msgContent.postId}`;
			break;
		case MESSAGE_TYPE_ENUM.STICKER:
			msgContentText = `https://chat-img.jwznb.com/${msgContent.imageId}`;
			break;
		case MESSAGE_TYPE_ENUM.HTML:
			msgContentText = contentLimit(msgContent.text);
			break;
		case MESSAGE_TYPE_ENUM.VIDEO:
			msgContentText = msgContent.videoUrl;
			break;
		case MESSAGE_TYPE_ENUM.AUDIO:
			msgContentText = msgContent.audioUrl;
			break;
		case MESSAGE_TYPE_ENUM.CALL:
			msgContentText = msgContent.callStatusText;
			break;
		case MESSAGE_TYPE_ENUM.A2UI:
			msgContentText = contentLimit(msgContent.text);
			break;
		default:
			msgContentText = contentLimit(msgContent.text);
	}
	return { msgTypeText, msgContentText };
}

function contentLimit(content: string): string {
	if (content.length > 300) return content.slice(0, 294) + "......";
	return content;
}
