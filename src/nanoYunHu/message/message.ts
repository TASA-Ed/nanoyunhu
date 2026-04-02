import { Logger } from "../../utils/logger.ts";
import { PushMessage } from "../../utils/types/wss_client_types.ts";
import { getGroupName } from "../cached/cached.ts";
import type { TCmdMap } from "../../utils/types/wss_client_types.ts";

const log = new Logger({ prefix: "Message" });

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
		// 文本！
		case "1":
			log.info(chat, sender, contentLimit(msg?.data?.msg?.content?.text as string));
			break;
		// 图片！
		case "2":
			log.info(chat, sender, `[图片](${msg?.data?.msg?.content?.imageUrl as string})`);
			break;
		// Markdown！
		case "3":
			log.info(chat, sender, `[Markdown 消息] ${contentLimit(msg?.data?.msg?.content?.text as string)}`);
			break;
		// 文件
		case "4":
			log.info(
				chat,
				sender,
				`[文件消息](${msg?.data?.msg?.content?.fileName as string} ${msg?.data?.msg?.content?.fileUrl as string})`
			);
			break;
		// 帖子
		case "6":
			log.info(
				chat,
				sender,
				`[帖子消息](${msg?.data?.msg?.content?.postTitle as string} ${msg?.data?.msg?.content?.postId as string})`
			);
			break;
		// 表情
		case "7":
			log.info(chat, sender, `[表情消息](https://chat-img.jwznb.com/${msg?.data?.msg?.content?.stickerUrl as string})`);
			break;
		// HTML
		case "8":
			log.info(chat, sender, `[HTML 消息] ${contentLimit(msg?.data?.msg?.content?.text as string)}`);
			break;
		// 视频
		case "10":
			log.info(chat, sender, `[视频消息](${msg?.data?.msg?.content?.videoUrl as string})`);
			break;
		// 语音
		case "11":
			log.info(chat, sender, `[语音消息](${msg?.data?.msg?.content?.audioUrl as string})`);
			break;
		// 语音通话
		case "13":
			log.info(chat, sender, `[语音通话消息](${msg?.data?.msg?.content?.callStatusText as string})`);
			break;
		// A2UI
		case "14":
			log.info(chat, sender, `[A2UI 消息](${contentLimit(msg?.data?.msg?.content?.text as string)})`);
			break;
	}
}

function contentLimit(content: string): string {
	if (content.length > 300) return content.slice(0, 294) + "......";
	return content;
}
