import { Logger } from '../utils/logger.js';
import { request } from '../utils/http.js';
import { UserInfoWeb, HttpRequestFailedOn5Error } from '../types.js';

export type TokenTest =
	| { success: true; userId: string | number; userName: string; token: string }
	| { success: false; error: string };

const USER_INFO_URL = 'https://chat-web-go.jwzhd.com/v1/user/info';
const REQUEST_TIMEOUT_MS = 8000;
const MAX_RETRIES = 5;

export async function tokenTest(token: string, log: Logger): Promise<TokenTest> {
	for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
		const response = await request<UserInfoWeb>(
			USER_INFO_URL,
			{ headers: { token } },
			REQUEST_TIMEOUT_MS,
			log
		);

		if (response.success && response.data.code === 1) {
			log.debug('Data:', response.data);
			return {
				success: true,
				userId: response.data.data.user.userId,
				userName: response.data.data.user.nickname,
				token,
			};
		}

		if (response.success) {
			log.warn(`token ${token} 验证失败。（${response.data.code}）`);
			return { success: false, error: response.data.msg };
		}

		if (response.isJson) {
			log.warn(`token ${token} 验证失败。（${response.error.code}）`);
			return { success: false, error: response.error.msg }; 
		}

		const err = response.error?.message ?? 'Unknown error';
		if (attempt === MAX_RETRIES) {
			throw new HttpRequestFailedOn5Error(err);
		}

		log.warn(`token ${token} 请求失败，将重试。（${attempt}/${MAX_RETRIES}）${err}`);
	}

	throw new HttpRequestFailedOn5Error('Unexpected retry loop exit');
}
