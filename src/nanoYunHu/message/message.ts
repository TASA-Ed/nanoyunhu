import { Logger } from "../../utils/logger.ts";
import { PushMessage } from "../../utils/types/wss_client_types.ts";
import { getGroupName } from "../cached/cached.ts";

export function pushMessage(data: unknown, type: string | false): void {
	const log = new Logger({ prefix: "Message" });
	if (type !== false && type?.includes("push_message")) {
		const msg = data as PushMessage;
		const chat = `[${msg?.data?.msg?.chatType == "2" ? getGroupName(msg?.data?.msg?.chatId as string) : msg?.data?.msg?.sender?.name}(${msg?.data?.msg?.chatId as string})]`;
		const sender = `[${msg?.data?.msg?.sender?.name as string}(${msg?.data?.msg?.sender?.chatId as string})]`;
		switch (msg?.data?.msg?.contentType as string) {
			// 文本！
			case "1":
				log.info(chat, sender, msg?.data?.msg?.content?.text as string);
				break;
			// 图片！
			case "2":
				log.info(chat, sender, `[图片](${msg?.data?.msg?.content?.imageUrl as string})`);
				break;
			// Markdown！
			case "3":
				log.info(chat, sender, `[Markdown 消息](${msg?.data?.msg?.content?.text as string})`);
				break;
		}
	}
}
