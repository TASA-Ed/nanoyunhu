import type { FastifyRequest } from "fastify";
import type { User } from "../utils/user/user_types.ts";
import { type User as SatoriUser, Channel as SatoriChannel } from "@satorijs/protocol";
import type { GroupInfo } from "../utils/group/group_types.ts";

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

export function decodeUser(user: User): SatoriUser {
	return {
		id: user.data.user.userId,
		nick: user.data.user.nickname,
		avatar: user.data.user.avatarUrl,
		isBot: false
	};
}

export function decodeGroupToChannel(group: GroupInfo): SatoriChannel {
	return {
		id: group.data.groupId,
		type: SatoriChannel.Type.TEXT,
		name: group.data.name
	};
}

export function decodeUserToChannel(user: User): SatoriChannel {
	return {
		id: user.data.user.userId,
		type: SatoriChannel.Type.DIRECT,
		name: user.data.user.nickname
	};
}
