import { Logger } from '../utils/logger.ts';
import { tokenTest, TokenTest } from './tokenTest.ts';
import { login } from './login.ts';
import { persistConfig } from "../config.ts";
import { WssClient } from "../utils/wss.ts";
import { startServer } from "../utils/server.ts";

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
			persistConfig(log);
		}
	} else {
		if (hasConfiguredToken) {
			log.warn("配置的 token 无效。");
			delete global.appConfig.account.token;
			persistConfig(log);

			log.warn("已清除无效 token，尝试重新登录...");
			testData = await login();
			if (!testData.success) {
				throw new InvalidTokenError();
			}

			log.info(`登录成功。欢迎 ${testData.userName}(${testData.userId})。`);
			global.appConfig.account.token = testData.token;
			persistConfig(log);
		} else throw new InvalidTokenError();
	}

	const client = new WssClient({
		url: "wss://chat-ws-go.jwzhd.com/ws",
		userId: testData.userId.toString(),
		token: testData.token,
		platform: global.appConfig.account.platform,

		onOpen: () => log.info("WebSocket 已连接！"),
		onMessage: (data) => log.info("收到 Websocket 消息:", data),
		onClose: (code, reason) => log.warn(`Websocket 关闭 ${code}: ${reason}`),
		onError: (err) => log.error("Websocket 错误:", err.message),
	});

	await client.connect();

	await startServer(global.appConfig.port);
}
