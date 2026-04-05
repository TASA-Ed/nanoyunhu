import { Logger } from "../../utils/logger.ts";
import { PushMessage } from "../../utils/types/wss_client_types.ts";
import { getGroupName } from "../cached/cached.ts";
import type { TCmdMap } from "../../utils/types/wss_client_types.ts";

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
		pushMessage(data as PushMessage, log);
	} else if (type?.includes("draft_input")) {
	} else if (type?.includes("file_send_message")) {
	} else if (type?.includes("edit_message")) {
	} else if (type?.includes("invite_apply")) {
	}
}

export function pushMessage(data: PushMessage, log: Logger): void {
	const msg = data as PushMessage;
	const chat = `[${msg?.data?.msg?.chatType == "2" ? getGroupName(msg?.data?.msg?.chatId as string) : msg?.data?.msg?.sender?.name}(${msg?.data?.msg?.chatId as string})]`;
	const sender = `[${msg?.data?.msg?.sender?.name as string}(${msg?.data?.msg?.sender?.chatId as string})]`;
	switch (msg?.data?.msg?.contentType as string) {
		case MessageTypeEnum.TEXT:
			log.info(chat, sender, contentLimit(msg?.data?.msg?.content?.text as string));
			break;
		case MessageTypeEnum.IMAGE:
			log.info(chat, sender, `[图片](${msg?.data?.msg?.content?.imageUrl as string})`);
			break;
		case MessageTypeEnum.MARKDOWN:
			log.info(chat, sender, `[Markdown 消息] ${contentLimit(msg?.data?.msg?.content?.text as string)}`);
			break;
		case MessageTypeEnum.FILE:
			log.info(
				chat,
				sender,
				`[文件消息](${msg?.data?.msg?.content?.fileName as string} ${msg?.data?.msg?.content?.fileUrl as string})`
			);
			break;
		case MessageTypeEnum.POST:
			log.info(
				chat,
				sender,
				`[帖子消息](${msg?.data?.msg?.content?.postTitle as string} ${msg?.data?.msg?.content?.postId as string})`
			);
			break;
		case MessageTypeEnum.STICKER:
			log.info(chat, sender, `[表情消息](https://chat-img.jwznb.com/${msg?.data?.msg?.content?.stickerUrl as string})`);
			break;
		case MessageTypeEnum.HTML:
			log.info(chat, sender, `[HTML 消息] ${contentLimit(msg?.data?.msg?.content?.text as string)}`);
			break;
		case MessageTypeEnum.VIDEO:
			log.info(chat, sender, `[视频消息](${msg?.data?.msg?.content?.videoUrl as string})`);
			break;
		case MessageTypeEnum.AUDIO:
			log.info(chat, sender, `[语音消息](${msg?.data?.msg?.content?.audioUrl as string})`);
			break;
		case MessageTypeEnum.CALL:
			log.info(chat, sender, `[语音通话消息](${msg?.data?.msg?.content?.callStatusText as string})`);
			break;
		case MessageTypeEnum.A2UI:
			log.info(chat, sender, `[A2UI 消息](${contentLimit(msg?.data?.msg?.content?.text as string)})`);
			break;
	}
}

function contentLimit(content: string): string {
	if (content.length > 300) return content.slice(0, 294) + "......";
	return content;
}
