import type { FastifyInstance } from "fastify";
import { ILogger } from "../../../types.ts";
import type { ISatoriHandler, HandlerMap } from "./satori_types.ts";
import { reqValid } from "./server_utils.ts";
import {
	ChannelDeleteHandler,
	ChannelGetHandler,
	ChannelListHandler,
	ChannelMuteHandler,
	ChannelUpdateHandler,
	UserChannelCreateHandler
} from "./channel/channel.ts";
import { LoginGetHandler } from "./login/login.ts";
import { UserGetHandler } from "./user/user.ts";
import { FriendApproveHandler, FriendDeleteHandler, FriendListHandler } from "./friend/friend.ts";
import { fastifyPlugin } from "fastify-plugin";

function buildHandlerMap<T extends ISatoriHandler>(handlers: T[]): HandlerMap<T> {
	return Object.fromEntries(handlers.map((h) => [h.feature, h])) as HandlerMap<T>;
}

/**
 * HandlerMap
 * @example "channel.get" => ChannelGetHandler
 */
export const Handlers: HandlerMap<ISatoriHandler> = buildHandlerMap([
	new ChannelGetHandler(),
	new ChannelListHandler(),
	new LoginGetHandler(),
	new UserGetHandler(),
	new ChannelMuteHandler(),
	new ChannelDeleteHandler(),
	new ChannelUpdateHandler(),
	new UserChannelCreateHandler(),
	new FriendListHandler(),
	new FriendDeleteHandler(),
	new FriendApproveHandler()
]);

/**
 * 注册 Satori 协议到服务器
 */
export const satori = fastifyPlugin<{ logger: ILogger }>(
	/**
	 * @param server {FastifyInstance} fastify 服务器
	 * @param opts { { logger: ILogger } } logger 日志对象
	 */
	async (server: FastifyInstance, opts: { logger: ILogger }): Promise<void> => {
		const log = opts.logger.child("Satori");

		try {
			server.get("/satori/v1/:name", async (_req, rep): Promise<string> => {
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
			return;
		}

		return;
	}
);
