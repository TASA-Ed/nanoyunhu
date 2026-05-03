import type { FeatureString, ISatoriHandler } from "../satori_types.ts";
import type { FastifyReply } from "fastify";
import type { ILogger } from "../../../../types.ts";
import { Friend, type List } from "@satorijs/protocol";
import { decodeAddressBookToFriend } from "../server_utils.ts";
import { approveRequest, deleteFriend, getAddressBookList } from "../../utils/friend/friend.ts";
import { TAddressBookDataList } from "../../utils/friend/friend_types.ts";

export class FriendListHandler implements ISatoriHandler {
	readonly feature: FeatureString = "friend.list";

	validate(_body: object | undefined): _body is undefined {
		return true;
	}

	async register(
		_body: undefined,
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<List<Friend> | string | undefined> {
		const list = await getAddressBookList(log);

		if (list?.status?.code == 1) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {
				data: list.data[0].data.map((item: TAddressBookDataList) => {
					return decodeAddressBookToFriend(item);
				})
			};
		}

		rep.code(500);
		log.debug(url, "ERROR:", "查询失败");

		return "query failed";
	}
}

export class FriendDeleteHandler implements ISatoriHandler<{ user_id?: string }> {
	readonly feature: FeatureString = "friend.delete";

	validate(body: object | undefined): body is { user_id?: string } {
		if (body == undefined || typeof body !== "object") return false;
		return !("user_id" in body) || typeof (body as any).user_id === "string";
	}

	async register(
		body: { user_id?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<{} | string | undefined> {
		if (body.user_id == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		const del = await deleteFriend(body.user_id, 1, log);

		if (del?.code == 1) {
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

export class FriendApproveHandler implements ISatoriHandler<{
	message_id?: string;
	approve?: boolean;
	comment?: string;
}> {
	readonly feature: FeatureString = "friend.approve";

	validate(body: object | undefined): body is { message_id?: string; approve?: boolean; comment?: string } {
		if (body == undefined || typeof body !== "object") return false;
		if (!("approve" in body) || typeof (body as any).approve !== "boolean") return false;
		return !("message_id" in body) || typeof (body as any).message_id === "string";
	}

	async register(
		body: { message_id?: string; approve?: boolean; comment?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<{} | string | undefined> {
		if (body.message_id == undefined || body.approve == undefined) {
			rep.code(400);
			log.debug(url, "ERROR:", "Bad Request");
			return "Bad Request";
		}

		const approve = await approveRequest(Number(body.message_id), body.approve ? 1 : 2, log);

		if (approve?.code == 1) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {};
		}

		rep.code(500);
		log.debug(url, "ERROR:", "失败");

		return "failed";
	}
}
