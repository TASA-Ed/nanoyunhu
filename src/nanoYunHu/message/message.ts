import { Logger } from "../../utils/logger.ts";
import type { ILogger } from "../../types.ts";
import { TPushMessage, TPushMessageContent } from "../../utils/types/wss_client_types.ts";
import { getGroupName } from "../cached/cached.ts";
import type { TCmdMap } from "../../utils/types/wss_client_types.ts";
import { parseButton } from "./button.ts";

const log = new Logger({ prefix: "Message" });

export const MessageTypeEnum = {
	// 文本消息！
	TEXT: "1",
	// 图片消息
	IMAGE: "2",
	// Markdown 消息！
	MARKDOWN: "3",
	// 文件消息
	FILE: "4",
	// 帖子消息
	POST: "6",
	// 表情消息
	STICKER: "7",
	// HTML 消息
	HTML: "8",
	// 视频消息
	VIDEO: "10",
	// 语音消息
	AUDIO: "11",
	// 语音通话
	CALL: "13",
	// A2UI 消息
	A2UI: "14"
} as const satisfies Record<string, string>;

export type TMessageTypeValues = (typeof MessageTypeEnum)[keyof typeof MessageTypeEnum];

export const MessageTypeText = {
	[MessageTypeEnum.TEXT]: "文本消息",
	[MessageTypeEnum.IMAGE]: "图片消息",
	[MessageTypeEnum.MARKDOWN]: "Markdown 消息",
	[MessageTypeEnum.FILE]: "Markdown 消息",
	[MessageTypeEnum.POST]: "帖子消息",
	[MessageTypeEnum.STICKER]: "表情消息",
	[MessageTypeEnum.HTML]: "HTML 消息",
	[MessageTypeEnum.VIDEO]: "视频消息",
	[MessageTypeEnum.AUDIO]: "语音消息",
	[MessageTypeEnum.CALL]: "语音通话消息",
	[MessageTypeEnum.A2UI]: "A2UI 消息"
} as const satisfies Record<TMessageTypeValues, string>;

export function wssClientMessage(data: unknown, type: TCmdMap | false): void {
	if (!type) return;
	if (type?.includes("push_message")) {
		pushMessage(data as TPushMessage, log);
	} else if (type?.includes("draft_input")) {
	} else if (type?.includes("file_send_message")) {
	} else if (type?.includes("edit_message")) {
	} else if (type?.includes("invite_apply")) {
	}
}

export function pushMessage(data: TPushMessage, log: ILogger): void {
	const msg = data as TPushMessage;
	const chat = `[${msg?.data?.msg?.chatType == "2" ? getGroupName(msg?.data?.msg?.chatId as string) : msg?.data?.msg?.sender?.name}(${msg?.data?.msg?.chatId as string})]`;
	const sender = `[${msg?.data?.msg?.sender?.name as string}(${msg?.data?.msg?.sender?.chatId as string})]`;
	const { msgTypeText, msgContentText } = messageLog(
		msg?.data?.msg?.contentType as string,
		msg?.data?.msg?.content as TPushMessageContent
	);
	const button = parseButton(msg?.data?.msg?.content?.buttons as string, log);
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

function messageLog(msgType: string, msgContent: TPushMessageContent): { msgTypeText: string; msgContentText: string } {
	const messageTypeText = MessageTypeText[msgType];
	let msgTypeText: string = !messageTypeText ? "[未知消息]" : `[${messageTypeText}]`;
	let msgContentText: string;
	switch (msgType) {
		case MessageTypeEnum.TEXT:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		case MessageTypeEnum.IMAGE:
			msgContentText = msgContent.imageUrl as string;
			break;
		case MessageTypeEnum.MARKDOWN:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		case MessageTypeEnum.FILE:
			msgContentText = `${msgContent.fileName as string} ${msgContent.fileUrl as string}`;
			break;
		case MessageTypeEnum.POST:
			msgContentText = `${msgContent.postTitle as string} ${msgContent.postId as string}`;
			break;
		case MessageTypeEnum.STICKER:
			msgContentText = `https://chat-img.jwznb.com/${msgContent.stickerUrl as string}`;
			break;
		case MessageTypeEnum.HTML:
			msgContentText = contentLimit(msgContent.text as string);
			break;
		case MessageTypeEnum.VIDEO:
			msgContentText = msgContent.videoUrl as string;
			break;
		case MessageTypeEnum.AUDIO:
			msgContentText = msgContent.audioUrl as string;
			break;
		case MessageTypeEnum.CALL:
			msgContentText = msgContent.callStatusText as string;
			break;
		case MessageTypeEnum.A2UI:
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
