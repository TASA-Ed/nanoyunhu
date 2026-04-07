import { decodeUser } from "../server_utils.ts";
import { getUser } from "../../utils/user/user.ts";
import type { FastifyReply } from "fastify";
import type { ILogger } from "../../../../types.ts";
import type { User as SatoriUser } from "@satorijs/protocol";
import type { FeatureString, ISatoriHandler } from "../satori_types.ts";

export class UserGetHandler implements ISatoriHandler<{ user_id?: string }> {
	readonly feature: FeatureString = "user.get";

	validate(body: object | undefined): body is { user_id?: string } {
		if (body == undefined || typeof body !== "object") return false;
		return !("user_id" in body) || typeof (body as any).user_id === "string";
	}

	async register(
		body: { user_id?: string },
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<SatoriUser | string | undefined> {
		const user = await getUser(body.user_id ?? global.accountData.userId?.toString(), log);
		if (user) {
			rep.type("application/json");
			rep.code(200);
			log.debug(url, "HTTP 200");
			return decodeUser(user);
		}
		rep.code(500);
		log.debug(url, "ERROR:", "查询失败");

		return "query failed";
	}
}
