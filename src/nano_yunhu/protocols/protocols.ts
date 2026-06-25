import { type FastifyInstance } from "fastify";
import { TProtocols } from "#/types.ts";
import { Logger } from "#/utils/logger.ts";
import { satori } from "./satori/satori.ts";
import { reverseProxy } from "../reverse_proxy/reverse_proxy.ts";
import { fastifyPlugin } from "fastify-plugin";

const logger = new Logger({ prefix: "Protocol" });

/**
 * 注册协议到服务器
 */
export const registerProtocol = fastifyPlugin<{ protocol: TProtocols }>(
	/**
	 * @param app {FastifyInstance} fastify 服务器
	 * @param options { { protocol: TProtocols } } protocol 协议
	 */
	async (
		app: FastifyInstance,
		options: {
			protocol: TProtocols;
		} = { protocol: "satori" }
	): Promise<void> => {
		app.register(reverseProxy);
		switch (options.protocol) {
			case "satori":
				app.register(satori, { logger });
				break;
			default:
				app.register(satori, { logger });
		}
	}
);
