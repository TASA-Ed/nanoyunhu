import { decodeGroupToChannel, decodeUserToChannel } from "../server_utils.ts";
import { editGroup, getGroup, quitGroup, setGroupMsgTypeLimit } from "../../utils/group/group.ts";
import { getUser } from "../../utils/user/user.ts";
import type { FastifyReply } from "fastify";
import type { ILogger } from "../../../../types.ts";
import { Channel, type List } from "@satorijs/protocol";
import type { FeatureString, ISatoriHandler } from "../satori_types.ts";
import { TMessageTypeValues } from "../../../message/message.ts";

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

export class ChannelMuteHandler implements ISatoriHandler<{ channel_id?: string; duration?: number }> {
	readonly feature: FeatureString = "channel.mute";

	validate(body: object | undefined): body is { channel_id?: string; duration?: number } {
		if (body == undefined || typeof body !== "object") return false;
		if (!("duration" in body) || typeof (body as any).duration !== "number") return false;
		return !("channel_id" in body) || typeof (body as any).channel_id === "string";
	}

	async register(
		body: { channel_id?: string; duration?: number },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<{} | string | undefined> {
		if (body.channel_id == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		const msgType: TMessageTypeValues[] =
			body.duration !== 0 ? [] : ["1", "2", "3", "4", "6", "7", "8", "10", "11", "13", "14"];
		const group = await setGroupMsgTypeLimit(body.channel_id, msgType, log);
		if (group) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {};
		}

		rep.code(500);
		log.debug(url, "ERROR:", "设置失败");

		return "set failed";
	}
}

export class ChannelDeleteHandler implements ISatoriHandler<{ channel_id?: string }> {
	readonly feature: FeatureString = "channel.delete";

	validate(body: object | undefined): body is { channel_id?: string } {
		if (body == undefined || typeof body !== "object") return false;
		return !("channel_id" in body) || typeof (body as any).channel_id === "string";
	}

	async register(
		body: { channel_id?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<{} | string | undefined> {
		if (body.channel_id == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		const group = await quitGroup(body.channel_id, log);
		if (group) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {};
		}

		rep.code(500);
		log.debug(url, "ERROR:", "删除失败");

		return "delete failed";
	}
}

export class ChannelUpdateHandler implements ISatoriHandler<{ channel_id?: string; data?: Channel }> {
	readonly feature: FeatureString = "channel.update";

	validate(body: object | undefined): body is { channel_id?: string; data?: Channel } {
		if (body == undefined || typeof body !== "object") return false;
		if (!("data" in body) || typeof (body as any).data !== "object") return false;
		if (!("name" in (body as any).data) || typeof (body as any).data.name !== "string") return false;
		return !("channel_id" in body) || typeof (body as any).channel_id === "string";
	}

	async register(
		body: { channel_id?: string; data?: Channel },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<{} | string | undefined> {
		if (body.channel_id == undefined || body.data == undefined || body.data.name == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		const group = await editGroup(body.channel_id, { name: body.data.name }, log);
		if (group) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {};
		}

		rep.code(500);
		log.debug(url, "ERROR:", "设置失败");

		return "set failed";
	}
}

export class UserChannelCreateHandler implements ISatoriHandler<{ user_id?: string }> {
	readonly feature: FeatureString = "user.channel.create";

	validate(body: object | undefined): body is { user_id?: string } {
		if (body == undefined || typeof body !== "object") return false;
		return !("user_id" in body) || typeof (body as any).user_id === "string";
	}

	async register(
		body: { user_id?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<Channel | string | undefined> {
		if (body.user_id == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		rep.code(200);
		log.debug(url, "HTTP 200");
		rep.type("application/json");
		return {
			id: "private:" + body.user_id,
			type: Channel.Type.DIRECT
		};
	}
}
