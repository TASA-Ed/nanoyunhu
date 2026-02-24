import { Logger } from '../utils/logger.js';
import { request } from '../utils/http.js';
import { UserInfoWeb, HttpRequestFailedOn5Error } from '../types.js';
// import { UserInfoV1 } from '../types.js';
// import { resolve } from "node:path";

export type TokenTest = { success: true; userId: string | number; userName: string; token: string; } | { success: false; error: string; };

export async function tokenTest(token: string, log: Logger):Promise<TokenTest> {
	let count = 0;

	while (true) {
		// 尽量不要用返回 proto 的 API
		const response = await request<UserInfoWeb>("https://chat-web-go.jwzhd.com/v1/user/info", { headers: { "token": token } }, 8000, log);
		// token 为空的话返回的是个 json，解析 proto 会报错，但是已经检测过不为空了，所以目前这里应该不需要检测了
		// const response = await request<UserInfoV1>("https://chat-go.jwzhd.com/v1/user/info", { headers: { "token": token } }, 8000, log, { protoFile: resolve("./src/protos/userinfo.proto"), messageType: "api.user.UserInfo" });
		if (response.success && response.data.code === 1) {
			log.debug("Data:", response.data);
			return { success: true, userId: response.data.data.user.userId, userName: response.data.data.user.nickname, token };
		} else {
			let err: string;
			if (response.success) {
				log.warn(`token ${token} 验证失败。（${response.data.code}）`);
				return { success: false, error: response.data.msg }
			}
			else if (response.isJson) {
				log.warn(`token ${token} 验证失败。（${response.error.code}）`);
				return { success: false, error: response.error.msg }
			}
			else err = response.error.message;

			count++;

			if (count >= 5) throw new HttpRequestFailedOn5Error(err);
		}
	}
}
