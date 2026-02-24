import { Logger } from '../utils/logger.js';
import { tokenTest, TokenTest } from './tokenTest.js';
import { login } from './login.js';
import { saveConfig } from "../config.ts";

const log = new Logger({ prefix: 'Main' });

export class InvalidTokenError extends Error {
	constructor() {
		super("登录时获取到的 token 无效。");
		this.name = "InvalidTokenError";
	}
}

export async function main():Promise<void> {
	let config: boolean;
	let testData: TokenTest;
	if (global.appConfig?.account?.token) {
		testData = await tokenTest(global.appConfig?.account?.token, log)
		config = true;
	} else {
		log.warn("未配置 token ，尝试登录...");
		testData = await login();
		config = false;
	}

	if (testData.success) {
		log.info(`登录成功。欢迎 ${testData.userName}(${testData.userId})。`);
		if (!global.appConfig?.account?.token){
			global.appConfig.account.device = testData.token;
			try {
				saveConfig(global.appConfig);
				log.debug("已保存配置:", global.appConfig);
			} catch (e){
				log.error("保存配置失败:", e.message);
			}
			///
		}
	} else {
		if (config) {
			log.warn("配置的 token 无效。");
			delete global.appConfig.account.token;
			try {
				saveConfig(global.appConfig);
				log.debug("已保存配置:", global.appConfig);
			} catch (e){
				log.error("保存配置失败:", e.message);
			}
			await main();
		} else throw new InvalidTokenError();
	}
}
