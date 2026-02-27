import { FastifyInstance } from 'fastify';
import { Protocols } from "../types.ts";
import { Logger } from "../utils/logger.ts";

const logger = new Logger({ prefix: 'Protocol' });

/**
 * 注册协议到服务器
 * @param server {FastifyInstance} fastify 服务器
 * @param protocol {Protocols} 协议
 */
export async function registerProtocol(server: FastifyInstance, protocol: Protocols = global.appConfig.protocol): Promise<void> {
	if (server.server.listening) {
		logger.error("服务器已启动，无法注册协议");
		return;
	}
	switch (protocol){
		case 'satori':
			await satori(server);
			break;
		default:
			await satori(server);
	}
}

/**
 * 注册 Satori 协议到服务器
 * @param server {FastifyInstance} fastify 服务器
 */
export async function satori(server: FastifyInstance): Promise<void> {
	const log = logger.child("Satori");

	if (server.server.listening) {
		log.error("服务器已启动，无法注册 Satori 协议");
		return;
	}
	/*// ── User ───────────────────────────────────────────────────
	server.post('/user.get', async (_req, rep) => {
		rep.type('image/png').code(200);
		return png;
	});
	// ── Channel ─────────────────────────────────────────────────
	server.get('/captcha.png', async (_req, rep) => {
		rep.type('image/png').code(200);
		return png;
	});*/
}
