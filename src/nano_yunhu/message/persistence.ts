import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { TPushMessage, TPushMessageMsg } from "../../utils/types/wss_client_types.ts";
import type { ILogger } from "../../types.ts";
import { join } from "node:path";

export const CHAT_TYPE_ENUM = {
	// 用户
	USER: "1",
	// 群聊
	GROUP: "2",
	// 机器人
	BOT: "3"
} as const satisfies Record<string, string>;

export type TChatTypeValues = (typeof CHAT_TYPE_ENUM)[keyof typeof CHAT_TYPE_ENUM];

export const CHAT_TYPE_TEXT = {
	[CHAT_TYPE_ENUM.USER]: "User",
	[CHAT_TYPE_ENUM.GROUP]: "Group",
	[CHAT_TYPE_ENUM.BOT]: "Bot"
} as const satisfies Record<TChatTypeValues, string>;

export function saveMessage(msg: TPushMessage, log: ILogger): void {
	const type: string = CHAT_TYPE_TEXT[msg?.data?.msg?.chatType as string] ?? "Unknown";
	const id: string = msg?.data?.msg?.chatId ?? "0";
	const jsonPath: string = join(process.cwd(), "Nano_Yunhu", "Chats", type, id, "msg.json");
	const dirPath: string = join(process.cwd(), "Nano_Yunhu", "Chats", type, id);
	if (!existsSync(jsonPath)) {
		try {
			mkdirSync(dirPath, { recursive: true });
			writeFileSync(jsonPath, "[]", "utf-8");
		} catch (err) {
			log.error("Failed to create persistent file:", err);
			return;
		}
	}
	try {
		const persistentFile: TPushMessageMsg[] = JSON.parse(readFileSync(jsonPath, "utf8"));
		persistentFile.push(msg?.data?.msg as TPushMessageMsg);
		writeFileSync(jsonPath, JSON.stringify(persistentFile, null, 2), "utf-8");
		log.trace("Saved message to:", jsonPath);
	} catch (err) {
		log.error("Failed to save persistent file:", err);
		return;
	}
}
