import { decodeUser, reqValid, satoriPath } from "../utils.ts";
import { getUser } from "../../utils/user.ts";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../../utils/logger.ts";
import { Login as SatoriLogin, Status, Methods } from "@satorijs/protocol";

const features: string[] = [];
for (const [feature, info] of Object.entries(Methods)) {
	if (!info.name.includes("Reaction")) {
		features.push(feature);
	}
}
features.push("guild.plain");

export async function get(server: FastifyInstance, log: Logger): Promise<void> {
	server.post<{
		Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
	}>(satoriPath("login.get"), async (req, rep) => {
		// 总是为 ONLINE
		const p = satoriPath("login.get");
		log.debug("收到请求 POST", p);
		rep.type("text/plain");
		log.debug("Headers:", req.headers);
		const valid = reqValid(req);
		if (!valid.success) {
			if (valid.type == "auth") rep.code(401);
			else rep.code(400);
			log.debug(p, "ERROR:", valid.msg);
			return valid.msg;
		}
		log.debug("Body:", req.body);
		const user = await getUser(global.accountData.userId?.toString(), log);
		if (user) {
			rep.code(200);
			log.debug(p, "HTTP 200");
			rep.type("application/json");
			const data: SatoriLogin = {
				sn: global.accountData.sn,
				platform: "yunhu",
				user: decodeUser(user),
				status: Status.ONLINE,
				adapter: "nanoyunhu",
				features
			};
			return JSON.stringify(data);
		}
		rep.code(500);
		log.debug(p, "ERROR:", "查询失败");

		return "query failed";
	});
}
