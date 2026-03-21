import { decodeGroupToChannel, decodeUserToChannel, preReq, satoriPath } from "../server_utils.ts";
import { getGroup } from "../../utils/group/group.ts";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../../utils/logger.ts";
import { Channel, List } from "@satorijs/protocol";
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
			const valid = preReq(req, rep, p, log);
			if (valid) return valid;
			if (req.body?.channel_id === undefined) {
				rep.code(400);
				log.debug(p, "ERROR:", "Bad Request");
				return "Bad Request";
			}
			// Satori 私聊频道
			if (req.body?.channel_id?.startsWith("private:")) {
				const user = await getUser(req.body?.channel_id?.slice(8), log);
				if (user) {
					rep.code(200);
					log.debug(p, "HTTP 200");
					rep.type("application/json");
					return decodeUserToChannel(user);
				}
			} else {
				const group = await getGroup(req.body?.channel_id, log);
				if (group) {
					rep.code(200);
					log.debug(p, "HTTP 200");
					rep.type("application/json");
					return decodeGroupToChannel(group);
				}
			}

			rep.code(500);
			log.debug(p, "ERROR:", "查询失败");

			return "query failed";
		});
	}

	static async list(server: FastifyInstance, log: Logger): Promise<void> {
		server.post<{
			Body: { guild_id: string | undefined };
			Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
		}>(satoriPath("channel.list"), async (req, rep): Promise<List<Channel> | string | undefined> => {
			const p = satoriPath("channel.list");
			const valid = preReq(req, rep, p, log);
			if (valid) return valid;
			if (req.body?.guild_id === undefined) {
				rep.code(400);
				log.debug(p, "ERROR:", "Bad Request");
				return "Bad Request";
			}
			const group = await getGroup(req.body?.guild_id, log);
			if (group) {
				rep.code(200);
				log.debug(p, "HTTP 200");
				rep.type("application/json");
				return {
					data: [decodeGroupToChannel(group)]
				};
			}

			rep.code(500);
			log.debug(p, "ERROR:", "查询失败");

			return "query failed";
		});
	}

	// channel.create 不支持
}
