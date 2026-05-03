import type { FastifyRequest } from "fastify";
import type { TUser } from "../utils/user/user_types.ts";
import { type User, Channel, Friend } from "@satorijs/protocol";
import type { TGroupInfo } from "../utils/group/group_types.ts";
import { TAddressBookDataList } from "../utils/friend/friend_types.ts";

export function reqValid(req: FastifyRequest): { success: boolean; msg?: string; type?: "satori" | "auth" } {
	const platform = req.headers["satori-platform"] ?? req.headers["x-platform"];
	if (platform !== "nanoyunhu") return { success: false, msg: "login not found", type: "satori" };
	const userId = req.headers["satori-user-id"] ?? req.headers["x-self-id"];
	if (userId !== global.accountData.userId?.toString())
		return { success: false, msg: "login not found", type: "satori" };
	if (
		global.appConfig.protocol.accessToken.trim() !== "" &&
		req.headers.authorization != `Bearer ${global.appConfig.protocol.accessToken}`
	)
		return { success: false, msg: "invalid token", type: "auth" };
	return { success: true };
}

export function decodeUser(user: TUser): User {
	return {
		id: user.data.user.userId,
		nick: user.data.user.nickname,
		avatar: user.data.user.avatarUrl,
		isBot: false
	};
}

export function decodeGroupToChannel(group: TGroupInfo): Channel {
	return {
		id: group.data.groupId,
		type: Channel.Type.TEXT,
		name: group.data.name
	};
}

export function decodeUserToChannel(user: TUser): Channel {
	return {
		id: user.data.user.userId,
		type: Channel.Type.DIRECT,
		name: user.data.user.nickname
	};
}

export function decodeAddressBookToFriend(friend: TAddressBookDataList, isBot = false): Friend {
	return {
		user: {
			nick: friend.name,
			id: friend.chatId,
			avatar: friend.avatarUrl,
			isBot
		},
		nick: friend.chatId2
	};
}
