import { decodeUser } from "../server_utils.ts";
import { type Login as SatoriLogin, Methods, Status } from "@satorijs/protocol";
import type { FastifyReply } from "fastify";
import type { ILogger } from "../../../../types.ts";
import type { FeatureString, ISatoriHandler } from "../satori_types.ts";
import { Handlers } from "../satori.ts";
import { getUserObject } from "../../../cached/cached.ts";

export class LoginGetHandler implements ISatoriHandler {
	private Features: string[] | null = null;

	readonly feature: FeatureString = "login.get";

	validate(_body: object | undefined): _body is undefined {
		return true;
	}

	async register(
		_body: undefined,
		url: string,
		rep: FastifyReply,
		log: ILogger
	): Promise<SatoriLogin | string | undefined> {
		if (!this.Features) {
			this.Features = [];
			for (const [feature] of Object.entries(Methods)) {
				if (feature in Handlers) {
					this.Features.push(feature);
				}
			}
			this.Features.push("guild.plain");
		}
		const user = await getUserObject(global.accountData.userId?.toString());
		if (user) {
			rep.code(200);
			log.debug(url, "HTTP 200");
			rep.type("application/json");
			return {
				sn: global.accountData.sn,
				platform: "yunhu",
				user: decodeUser(user),
				status: Status.ONLINE,
				adapter: "nanoyunhu",
				features: this.Features
			};
		}
		rep.code(500);
		log.debug(url, "ERROR:", "查询失败");

		return "query failed";
	}
}
