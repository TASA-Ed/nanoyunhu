import { FastifyInstance, FastifyRequest } from 'fastify';
import { Protocols, User } from "../types.ts";
import { Logger } from "../utils/logger.ts";
import { request } from "../utils/http.ts";

const logger = new Logger({ prefix: 'Protocol' });

/**
 * 注册协议到服务器
 * @param server {FastifyInstance} fastify 服务器
 * @param protocol {Protocols} 协议
 */
export async function registerProtocol(server: FastifyInstance, protocol: Protocols = global.appConfig.protocol.type): Promise<void> {
	if (server.server.listening) {
		logger.error("服务器已启动，无法注册协议");
		return;
	}
	switch (protocol){
		case 'satori':
			await satori(server);
			break;
		default:
			await satori(server);
	}
}

/**
 * 注册 Satori 协议到服务器
 * @param server {FastifyInstance} fastify 服务器
 */
export async function satori(server: FastifyInstance): Promise<void> {
	const log = logger.child("Satori");

	if (server.server.listening) {
		log.error("服务器已启动，无法注册 Satori 协议");
		return;
	}

	// ── 通用 ───────────────────────────────────────────────────
	function path(path: string) {
		return "/satori/v1/"+path.replace(/^\//, "");
	}

	function reqValid(req: FastifyRequest): { success: boolean, msg?: string, type?: "satori" | "auth" } {
		if (req.headers["satori-platform"] != "nanoyunhu") return { success: false, msg: "Satori-Platform 错误，必须为 nanoyunhu", type: "satori" };
		if (req.headers["satori-user-id"] != global.accountData.userId) return { success: false, msg: "Satori-User-ID 错误，必须为云湖账号 ID", type: "satori" };
		if (!global.appConfig.protocol.accessToken.trim() && req.headers.authorization != `Bearer ${global.appConfig.protocol.accessToken}`) return { success: false, msg: "鉴权失败", type: "auth" };
		return { success: true };
	}
	// ── User ───────────────────────────────────────────────────
	function decodeUser(user: User): object {
		return {
			id: user.data.user.userId,
			nick: user.data.user.nickname,
			avatar: user.data.user.avatarUrl,
			is_bot: false,
			register_time: user.data.user.registerTime,
			register_time_text: user.data.user.registerTimeText,
			on_line_day: user.data.user.onLineDay,
			continuous_on_line_day: user.data.user.continuousOnLineDay,
			medals: user.data.user.medals.map(medal => ({
				id: medal.id,
				name: medal.name,
				desc: medal.desc,
				sort: medal.sort,
			})),
			is_vip: (user.data.user.isVip == 1),
		};
	}

	server.post<{
		Body: { "user_id": string | undefined };
		Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
	}>(path('user.get'), async (req, rep) => {
		const p = path('user.get');
		log.debug("收到请求 POST", p);
		rep.type('application/json');
		log.debug("Headers:", req.headers);
		const valid = reqValid(req);
		if (!valid.success) {
			if (valid.type=="auth") rep.code(401);
			else rep.code(400);
			log.debug(p, "ERROR:", valid.msg);
			return JSON.stringify({ success: false, msg: valid.msg });
		}
		log.debug("Body:", req.body);
		const user = await getUser(req.body?.user_id ?? global.accountData.userId?.toString(), log);
		if (user) {
			rep.code(200);
			log.debug(p, "HTTP 200");
			return JSON.stringify(decodeUser(user));
		}
		rep.code(500);
		log.debug(p, "ERROR:", "查询失败");

		return JSON.stringify({ success: false, msg: "查询失败" });
	});
	// ── Login ─────────────────────────────────────────────────
	server.post<{
		Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
	}>(path('login.get'), async (req, rep) => {
		// 总是为 ONLINE
		const p = path('login.get');
		log.debug("收到请求 POST", p);
		rep.type('application/json');
		log.debug("Headers:", req.headers);
		const valid = reqValid(req);
		if (!valid.success) {
			if (valid.type=="auth") rep.code(401);
			else rep.code(400);
			log.debug(p, "ERROR:", valid.msg);
			return JSON.stringify({ success: false, msg: valid.msg });
		}
		log.debug("Body:", req.body);
		const user = await getUser(global.accountData.userId?.toString(), log);
		if (user) {
			rep.code(200);
			log.debug(p, "HTTP 200");
			return JSON.stringify({
				sn: global.accountData.sn,
				platform: "yunhu",
				user: decodeUser(user),
				status: 1,
				adapter: "nanoyunhu"
			});
		}
		rep.code(500);
		log.debug(p, "ERROR:", "查询失败");

		return JSON.stringify({ success: false, msg: "查询失败" });
	});
	// ── Channel ─────────────────────────────────────────────────
	/*server.post<{
	  Body: { "channel_id": string | undefined };
		Headers: { "satori-platform": string | undefined; "satori-user-id": string | undefined };
	}>(path('channel.get'), async (req, rep) => {*/
}

async function getUser(id: string, log: Logger): Promise<User | undefined> {
	const response = await request<User>(
		`https://chat-web-go.jwzhd.com/v1/user/homepage?userId=${id}`,
		{ method: "GET" },
		global.appConfig.network.httpTimeoutMs,
		log
	);
	if (response.success && response.data.code === 1 && response.data.data.user.registerTime !== 0) {
		log.debug('Data:', response.data);
		return response.data;
	}
	if (response.success)
		log.debug('Failed:', response.data);
	else
		log.debug('Failed:', response.error);
	return undefined;
}
