import type { Logger } from "../../utils/logger.js";
import { request } from "../../utils/http.js";
import { SelfInfoWeb, HttpRequestFailedOn5Error, BASE_URL } from "../../types.js";
// import { SelfInfoV1 } from '../types.js';
// import protoText from "../protos/user_info.proto";

export type TokenTest = TokenTestSuccess | TokenTestFailure;

export interface TokenTestSuccess {
	readonly success: true;
	readonly userId: string | number;
	readonly userName: string;
	readonly token: string;
	readonly sn: number;
}
export interface TokenTestFailure {
	readonly success: false;
	readonly error: string;
}

// 尽量不要用返回 proto 的 API
const USER_INFO_URL = BASE_URL.web + "user/info";
// const USER_INFO_URL = BASE_URL.v1 + "user/info";

export async function tokenTest(token: string, log: Logger): Promise<TokenTest> {
	for (let attempt = 1; attempt <= 5; attempt++) {
		const response = await request<SelfInfoWeb>(
			USER_INFO_URL,
			{ headers: { token } },
			global.appConfig.network.httpTimeoutMs,
			log
		);
		/*
		const response = await request<SelfInfoV1>(
			USER_INFO_URL,
			{ headers: { token } },
			8000,
			log,
			{ protoFile: protoText, messageType: "api.user.UserInfo" }
		);
		*/

		if (response.success && response.data.code === 1) {
			log.trace("Data:", response.data);
			return {
				success: true,
				userId: response.data.data.user.userId,
				userName: response.data.data.user.nickname,
				token,
				sn: Math.floor(Math.random() * 900000) + 100000
			};
		}

		if (response.success) {
			log.debug("Failed:", response.data);
			log.warn(`token ${token} 验证失败。（${response.data.code}）`);
			return { success: false, error: response.data.msg };
		}

		if (response.isJson) {
			log.debug("Failed:", response.error);
			log.warn(`token ${token} 验证失败。（${response.error.code}）`);
			return { success: false, error: response.error.msg };
		}

		const err = response.error?.message ?? "Unknown error";
		if (attempt === 5) {
			throw new HttpRequestFailedOn5Error(err);
		}

		log.warn(`token ${token} 请求失败，将重试。（${attempt}/${5}）${err}`);
	}

	throw new HttpRequestFailedOn5Error("重试循环意外退出");
}
