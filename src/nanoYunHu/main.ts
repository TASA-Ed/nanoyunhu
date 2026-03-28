import { Logger } from "../utils/logger.ts";
import { tokenTest, TokenTest } from "./token_test.ts";
import { login } from "./login.ts";
import { persistConfig } from "../config.ts";
import { WssClient } from "../utils/wss.ts";
import { closeServer, server, startServer } from "../utils/server.ts";
import { registerProtocol } from "./protocols/protocols.ts";
import { BASE_URL } from "../types.ts";
import { PushMessage } from "../utils/types/wss_client_types.ts";
import { getGroupName } from "./cached.ts";

const log = new Logger({ prefix: "Main" });
let exitedBySigint = false;
let client: WssClient;

export class InvalidTokenError extends Error {
	constructor() {
		super("登录时获取到的 token 无效。");
		this.name = "InvalidTokenError";
	}
}

/**
 * 程序主函数
 * @description 注意：先运行入口点函数！此函数会自行运行！
 */
export async function main(): Promise<void> {
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
		if (!global.appConfig.account.token) {
			global.appConfig.account.token = testData.token;
			persistConfig(log);
		}
		global.accountData = testData;
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
			global.accountData = testData;
		} else throw new InvalidTokenError();
	}

	if (global.appConfig.protocol.accessToken.trim() === "")
		log.warn("警告：protocol.accessToken 为空，可能存在盗号风险！");

	client = new WssClient({
		url: BASE_URL.ws + "ws",
		userId: global.accountData.userId.toString(),
		token: global.accountData.token,

		onOpen: () => log.info("WebSocket 已连接！"),
		onMessage: (data, type) => {
			const log = new Logger({ prefix: "Message" });
			if (type !== false && type?.includes("push_message")) {
				const msg = data as PushMessage;
				switch (msg?.data?.msg?.contentType as string) {
					// 文本！
					case "1":
						log.info(
							`[${getGroupName(msg?.data?.msg?.chatId as string)}(${msg?.data?.msg?.chatId as string})]`,
							`[${msg?.data?.msg?.sender?.name as string}(${msg?.data?.msg?.sender?.chatId as string})]`,
							msg?.data?.msg?.content?.text as string
						);
				}
			}
		},
		onClose: (code, reason) => log.warn(`Websocket 关闭 ${code}: ${reason}`),
		onError: (err) => log.error("Websocket 错误:", err.message)
	});

	await client.connect();

	await registerProtocol(server);
	await startServer(global.appConfig.port);
}

/**
 * 程序退出时清理工作
 * @description 注意：执行完此函数后仍然需要执行 process.exit
 */
export async function exitClear(): Promise<void> {
	if (exitedBySigint) return;
	exitedBySigint = true;
	log.info(`收到 SIGINT 信号，正在退出...`);
	await closeServer();
	client?.destroy();
}

process.on("SIGINT", async () => {
	await exitClear();
	process.exit(130);
});
