import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../utils/logger.ts";
import type { ISatoriHandler, HandlerMap } from "./types.ts";
import { reqValid } from "./server_utils.ts";
import { ChannelGetHandler, ChannelListHandler } from "./channel/channel.ts";
import { LoginGetHandler } from "./login/login.ts";
import { UserGetHandler } from "./user/user.ts";

function buildHandlerMap<T extends ISatoriHandler>(handlers: T[]): HandlerMap<T> {
	return Object.fromEntries(handlers.map((h) => [h.feature, h])) as HandlerMap<T>;
}

export const Handlers: HandlerMap<ISatoriHandler> = buildHandlerMap([
	new ChannelGetHandler(),
	new ChannelListHandler(),
	new LoginGetHandler(),
	new UserGetHandler()
]);

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
		server.get<{
			Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
		}>("/satori/v1/:name", async (_req, rep): Promise<string> => {
			rep.type("text/plain");
			rep.status(405);
			return "method not found";
		});

		server.post<{
			Params: {
				name: string | undefined;
			};
			Body: object | null;
		}>("/satori/v1/:name", async (req, rep): Promise<string | undefined> => {
			log.debug("收到请求 POST", req.url);
			rep.type("text/plain");

			const { name } = req.params;
			if (!name) {
				rep.status(404);
				return "method not found";
			}

			log.debug("Headers:", req.headers);
			const valid = reqValid(req);
			if (!valid.success) {
				if (valid.type == "auth") rep.code(401);
				else rep.code(400);
				log.debug(req.url, "ERROR:", valid.msg);
				return valid.msg;
			}
			log.debug("Body:", req.body);

			const handle = Handlers[name];
			if (!handle) {
				rep.status(404);
				return "method not found";
			}

			if (!handle.validate(req.body)) {
				rep.status(400);
				return "Bad Request";
			}

			const logChild = log.child(name);

			try {
				return await handle.register(req.body, req.url, rep, logChild);
			} catch (e) {
				logChild.error(e);
				rep.status(500);
				return "Internal Server Error";
			}
		});
	} catch (e) {
		log.error("注册协议失败:", e);
		return false;
	}

	return undefined;
}
