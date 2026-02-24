import { Logger } from '../utils/logger.js';
import { tokenTest, TokenTest } from './tokenTest.js';
import { login } from './login.js';
import { persistConfig } from "../config.ts";

const log = new Logger({ prefix: 'Main' });

export class InvalidTokenError extends Error {
	constructor() {
		super("登录时获取到的 token 无效。");
		this.name = "InvalidTokenError";
	}
}

export async function main():Promise<void> {
	global.appConfig.account ??= {};

	let hasConfiguredToken = Boolean(global.appConfig.account.token);
	let testData: TokenTest;

	if (hasConfiguredToken) {
		testData = await tokenTest(global.appConfig.account.token!, log);
	} else {
		log.warn("未配置 token ，尝试登录...");
		testData = await login();
	}

	if (testData.success) {
		log.info(`登录成功。欢迎 ${testData.userName}(${testData.userId})。`);
		if (!global.appConfig.account.token){
			global.appConfig.account.token = testData.token;
			persistConfig();
			/// 未完成
		}
	} else {
		if (hasConfiguredToken) {
			log.warn("配置的 token 无效。");
			delete global.appConfig.account.token;
			persistConfig();

			log.warn("已清除无效 token，尝试重新登录...");
			testData = await login();
			if (testData.success) {
				log.info(`登录成功。欢迎 ${testData.userName}(${testData.userId})。`);
				global.appConfig.account.token = testData.token;
				persistConfig();
				return;
			}

			throw new InvalidTokenError();
		} else throw new InvalidTokenError();
	}
}
