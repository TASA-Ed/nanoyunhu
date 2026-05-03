import type { FeatureString, ISatoriHandler } from "../satori_types.ts";
import type { FastifyReply } from "fastify";
import type { ILogger } from "../../../../types.ts";
import { Friend, type List } from "@satorijs/protocol";
import { decodeAddressBookToFriend } from "../server_utils.ts";
import { getAddressBookList } from "../../utils/friend/friend.ts";
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

		if (list) {
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
