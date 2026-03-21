import { FastifyInstance } from "fastify";
import { Logger } from "../../../utils/logger.ts";
import { ISatoriFeatureHandler } from "./types.ts";
import { UserHandler } from "./user/user.ts";
import { LoginHandler } from "./login/login.ts";
import { ChannelHandler } from "./channel/channel.ts";

const handlers: ISatoriFeatureHandler[] = [LoginHandler, UserHandler, ChannelHandler];

/** 所有已注册的 Feature 列表（供 login.get 等接口对外输出） */
export const Features: string[] = handlers.flatMap((h) => h.features);

/**
 * 注册 Satori 协议到服务器
 * @param server {FastifyInstance} fastify 服务器
 * @param logger {Logger} 日志对象
 */
export async function satori(server: FastifyInstance, logger: Logger): Promise<undefined | false> {
	const log = logger.child("Satori");

	if (server.server.listening) {
		log.error("服务器已启动，无法注册 Satori 协议");
		return false;
	}

	try {
		// ── User ────────────────────────────────────────────────────
		await UserHandler.get(server, log);
		// ── Login ───────────────────────────────────────────────────
		await LoginHandler.get(server, log);
		// ── Channel ─────────────────────────────────────────────────
		await ChannelHandler.get(server, log);
		await ChannelHandler.list(server, log);
	} catch (e) {
		log.error("注册协议失败:", e);
		return false;
	}

	return undefined;
}
