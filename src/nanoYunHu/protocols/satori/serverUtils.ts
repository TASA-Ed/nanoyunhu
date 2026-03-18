import type { FastifyRequest } from "fastify";
import type { User } from "../utils/user/userTypes.ts";
import { User as SatoriUser } from "@satorijs/protocol";

export function satoriPath(path: string) {
	return "/satori/v1/" + path.replace(/^\//, "");
}

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
