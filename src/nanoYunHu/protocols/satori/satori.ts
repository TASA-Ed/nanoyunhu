import { FastifyInstance } from "fastify";
import { Logger } from "../../../utils/logger.ts";
import * as user from "./user/user.ts";
import * as login from "./login/login.ts";

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
		await user.get(server, log);
		// ── Login ───────────────────────────────────────────────────
		await login.get(server, log);
		// ── Channel ─────────────────────────────────────────────────
	} catch (e) {
		log.error("注册协议失败:", e);
		return false;
	}

	return undefined;
}
