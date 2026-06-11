import { type FastifyInstance } from "fastify";
import { fastifyHttpProxy } from "@fastify/http-proxy";

/**
 * 注册 file-oss 反代到服务器
 * @param app {FastifyInstance} fastify 服务器
 */
export async function registerFileOssProxy(app: FastifyInstance): Promise<void> {
	app.register(fastifyHttpProxy, {
		upstream: "https://chat-file-oss.jwznb.com",
		prefix: "/system/v1/rp-file-oss",
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
