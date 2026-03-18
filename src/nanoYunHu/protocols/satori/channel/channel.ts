import { reqValid, satoriPath } from "../serverUtils.ts";
import { getGroup } from "../../utils/group/group.ts";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../../utils/logger.ts";
import { Channel } from "@satorijs/protocol";
import { FeatureString } from "../types.ts";
import { getUser } from "../../utils/user/user.ts";

export class ChannelHandler {
	static readonly features: FeatureString[] = ["channel.get"];

	static async get(server: FastifyInstance, log: Logger): Promise<void> {
		server.post<{
			Body: { channel_id: string | undefined };
			Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
		}>(satoriPath("channel.get"), async (req, rep): Promise<Channel | string | undefined> => {
			const p = satoriPath("channel.get");
			log.debug("收到请求 POST", p);
			rep.type("text/plain");
			log.debug("Headers:", req.headers);
			if (req.body?.channel_id === undefined) {
				rep.code(400);
				log.debug(p, "ERROR:", "Bad Request");
				return "Bad Request";
			}
			const valid = reqValid(req);
			if (!valid.success) {
				if (valid.type == "auth") rep.code(401);
				else rep.code(400);
				log.debug(p, "ERROR:", valid.msg);
				return valid.msg;
			}
			log.debug("Body:", req.body);
			// Satori 私聊频道
			if (req.body?.channel_id?.startsWith("private:")) {
				const user = await getUser(req.body?.channel_id?.slice(8), log);
				if (user) {
					rep.code(200);
					log.debug(p, "HTTP 200");
					rep.type("application/json");
					return {
						id: user.data.user.userId,
						type: Channel.Type.DIRECT,
						name: user.data.user.nickname
					};
				}
			} else {
				const group = await getGroup(req.body?.channel_id, log);
				if (group) {
					rep.code(200);
					log.debug(p, "HTTP 200");
					rep.type("application/json");
					return {
						id: group.data.groupId,
						type: Channel.Type.TEXT,
						name: group.data.name
					};
				}
			}

			rep.code(500);
			log.debug(p, "ERROR:", "查询失败");

			return "query failed";
		});
	}
}
