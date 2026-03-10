import { FastifyInstance } from "fastify";
import { Protocols } from "../../types.ts";
import { Logger } from "../../utils/logger.ts";
import { satori } from "./satori/satori.ts";

const logger = new Logger({ prefix: "Protocol" });

/**
 * 注册协议到服务器
 * @param server {FastifyInstance} fastify 服务器
 * @param protocol {Protocols} 协议
 */
export async function registerProtocol(
	server: FastifyInstance,
	protocol: Protocols = global.appConfig.protocol.type
): Promise<void> {
	if (server.server.listening) {
		logger.error("服务器已启动，无法注册协议");
		return;
	}
	switch (protocol) {
		case "satori":
			await satori(server, logger);
			break;
		default:
			await satori(server, logger);
	}
}
