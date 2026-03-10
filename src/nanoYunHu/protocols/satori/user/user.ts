import { decodeUser, reqValid, satoriPath } from "../utils.ts";
import { getUser } from "../../utils/user.ts";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../../utils/logger.ts";
import type { User as SatoriUser } from "@satorijs/protocol";

export async function get(server: FastifyInstance, log: Logger): Promise<void> {
	server.post<{
		Body: { user_id: string | undefined };
		Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
	}>(satoriPath("user.get"), async (req, rep) => {
		const p = satoriPath("user.get");
		log.debug("收到请求 POST", p);
		log.debug("Headers:", req.headers);
		rep.type("text/plain");
		const valid = reqValid(req);
		if (!valid.success) {
			if (valid.type == "auth") rep.code(401);
			else rep.code(400);
			log.debug(p, "ERROR:", valid.msg);
			return valid.msg;
		}
		log.debug("Body:", req.body);
		const user = await getUser(req.body?.user_id ?? global.accountData.userId?.toString(), log);
		if (user) {
			rep.type("application/json");
			rep.code(200);
			log.debug(p, "HTTP 200");
			const data: SatoriUser = decodeUser(user);
			return JSON.stringify(data);
		}
		rep.code(500);
		log.debug(p, "ERROR:", "查询失败");

		return "query failed";
	});
}
