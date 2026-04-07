import { decodeGroupToChannel, decodeUserToChannel } from "../server_utils.ts";
import { getGroup } from "../../utils/group/group.ts";
import { getUser } from "../../utils/user/user.ts";
import type { FastifyReply } from "fastify";
import type { ILogger } from "../../../../types.ts";
import type { Channel, List } from "@satorijs/protocol";
import type { FeatureString, ISatoriHandler } from "../satori_types.ts";

export class ChannelGetHandler implements ISatoriHandler<{ channel_id?: string }> {
	readonly feature: FeatureString = "channel.get";

	validate(body: object | undefined): body is { channel_id?: string } {
		if (body == undefined || typeof body !== "object") return false;
		return !("channel_id" in body) || typeof (body as any).channel_id === "string";
	}

	async register(
		body: { channel_id?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<Channel | string | undefined> {
		if (body.channel_id == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}
		// Satori 私聊频道
		if (body.channel_id.startsWith("private:")) {
			const user = await getUser(body.channel_id.slice(8), log);
			if (user) {
				rep.code(200);
				log.debug(url, "HTTP 200");
				rep.type("application/json");
				return decodeUserToChannel(user);
			}
		} else {
			const group = await getGroup(body.channel_id, log);
			if (group) {
				rep.code(200);
				log.debug(url, "HTTP 200");
				rep.type("application/json");
				return decodeGroupToChannel(group);
			}
		}

		rep.code(500);
		log.debug(url, "ERROR:", "查询失败");

		return "query failed";
	}
}

export class ChannelListHandler implements ISatoriHandler<{ guild_id?: string }> {
	readonly feature: FeatureString = "channel.list";

	validate(body: object | undefined): body is { guild_id?: string } {
		if (body == undefined || typeof body !== "object") return false;
		return !("guild_id" in body) || typeof (body as any).guild_id === "string";
	}

	async register(
		body: { guild_id?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<List<Channel> | string | undefined> {
		if (body.guild_id == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		const group = await getGroup(body.guild_id, log);
		if (group) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {
				data: [decodeGroupToChannel(group)]
			};
		}

		rep.code(500);
		log.debug(url, "ERROR:", "查询失败");

		return "query failed";
	}
}
