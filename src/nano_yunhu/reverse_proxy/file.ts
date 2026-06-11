import { type FastifyInstance } from "fastify";
import { fastifyHttpProxy } from "@fastify/http-proxy";

/**
 * 注册 file 反代到服务器
 * @param app {FastifyInstance} fastify 服务器
 */
export async function registerFileProxy(app: FastifyInstance): Promise<void> {
	app.register(fastifyHttpProxy, {
		upstream: "https://chat-file.jwznb.com",
		prefix: "/system/v1/rp-file",
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
