import { Logger } from "#/utils/logger.ts";
import type { ILogger } from "#/types.ts";
import type { PWssPushMessage, PWssPushMessageContent, TCmdMap } from "@nanoyunhu/yunhu-protobuf-typia";
import { getGroupName } from "../cached/cached.ts";
import { parseButton } from "./button.ts";
import { saveMessage } from "./persistence.ts";
import { pluginStatus } from "../protocols/utils/message/message.ts";

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

export function wssClientMessage(data: unknown, type: TCmdMap | false): void {
	if (!type) return;
	if (type?.includes("push_message")) {
		pushMessage(data as PWssPushMessage, log);
		saveMessage(data as PWssPushMessage, log);
	} else if (type?.includes("draft_input")) {
	} else if (type?.includes("file_send_message")) {
	} else if (type?.includes("edit_message")) {
	} else if (type?.includes("invite_apply")) {
	}
}

export function pushMessage(msg: PWssPushMessage, log: ILogger): void {
	const chat = `[${msg?.data?.value?.chatType == 2 ? getGroupName(msg?.data?.value?.chatId as string) : msg?.data?.value?.sender?.name}(${msg?.data?.value?.chatId as string})]`;
	const sender = `[${msg?.data?.value?.sender?.name as string}(${msg?.data?.value?.sender?.chatId as string})]`;
	const { msgTypeText, msgContentText } = messageLog(
		msg?.data?.value?.contentType as number,
		msg?.data?.value?.content as PWssPushMessageContent
	);
	if (!global.appConfig.disableInternalPlugin && msgContentText == "#nanoyunhu") {
		pluginStatus(msg?.data?.value?.chatId as string, msg?.data?.value?.chatType as number);
	}
	const button = parseButton(msg?.data?.value?.content?.buttons as string, log);
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
}

function messageLog(
	msgType: number,
	msgContent: PWssPushMessageContent
): { msgTypeText: string; msgContentText: string } {
	const messageTypeText = MESSAGE_TYPE_TEXT[msgType];
	let msgTypeText: string = !messageTypeText ? "[未知消息]" : `[${messageTypeText}]`;
	let msgContentText: string;
	switch (msgType) {
		case MESSAGE_TYPE_ENUM.TEXT:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		case MESSAGE_TYPE_ENUM.IMAGE:
			msgContentText = msgContent.imageUrl as string;
			break;
		case MESSAGE_TYPE_ENUM.MARKDOWN:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		case MESSAGE_TYPE_ENUM.FILE:
			msgContentText = `${msgContent.fileName as string} ${msgContent.fileUrl as string}`;
			break;
		case MESSAGE_TYPE_ENUM.POST:
			msgContentText = `${msgContent.postTitle as string} ${msgContent.postId as string}`;
			break;
		case MESSAGE_TYPE_ENUM.STICKER:
			msgContentText = `https://chat-img.jwznb.com/${msgContent.stickerUrl as string}`;
			break;
		case MESSAGE_TYPE_ENUM.HTML:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		case MESSAGE_TYPE_ENUM.VIDEO:
			msgContentText = msgContent.videoUrl as string;
			break;
		case MESSAGE_TYPE_ENUM.AUDIO:
			msgContentText = msgContent.audioUrl as string;
			break;
		case MESSAGE_TYPE_ENUM.CALL:
			msgContentText = msgContent.callStatusText as string;
			break;
		case MESSAGE_TYPE_ENUM.A2UI:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		default:
			msgContentText = contentLimit(msgContent.text as string);
	}
	return { msgTypeText, msgContentText };
}

function contentLimit(content: string): string {
	if (content.length > 300) return content.slice(0, 294) + "......";
	return content;
}
