import { type FastifyInstance } from "fastify";
import { fastifyHttpProxy } from "@fastify/http-proxy";

/**
 * 注册 img 反代到服务器
 * @param app {FastifyInstance} fastify 服务器
 */
export async function registerImgProxy(app: FastifyInstance): Promise<void> {
	app.register(fastifyHttpProxy, {
		upstream: "https://chat-img.jwznb.com",
		prefix: "/system/v1/rp-img",
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
	app.register(fastifyHttpProxy, {
		upstream: "https://chat-img2.jwznb.com",
		prefix: "/system/v1/rp-img2",
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
	app.register(fastifyHttpProxy, {
		upstream: "https://chat-img3.jwznb.com",
		prefix: "/system/v1/rp-img3",
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
