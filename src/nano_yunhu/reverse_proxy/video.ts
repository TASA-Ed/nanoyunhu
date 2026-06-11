import { type FastifyInstance } from "fastify";
import { fastifyHttpProxy } from "@fastify/http-proxy";

/**
 * 注册 video 反代到服务器
 * @param app {FastifyInstance} fastify 服务器
 */
export async function registerVideoProxy(app: FastifyInstance): Promise<void> {
	app.register(fastifyHttpProxy, {
		upstream: "https://chat-video1.jwznb.com",
		prefix: "/system/v1/rp-video1",
		rewritePrefix: "/",
		replyOptions: {
			rewriteRequestHeaders(_req, headers) {
				return {
					...headers,
					referer: "http://myapp.jwznb.com"
				};
			}
		}
	});
}
