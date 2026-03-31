import { Logger } from "../utils/logger.ts";
import { tokenTest, TokenTest } from "./login/token_test.ts";
import { login } from "./login/login.ts";
import { persistConfig } from "../config.ts";
import { WssClient } from "../utils/wss.ts";
import { closeServer, server, startServer } from "../utils/server.ts";
import { registerProtocol } from "./protocols/protocols.ts";
import { BASE_URL } from "../types.ts";
import { encryptToken, decryptToken } from "./login/token_crypto.ts";
import { getIdAndPlatform, getMemToMiB, hardwareRequirementsAssessment } from "../utils/device.ts";
import { pushMessage } from "./message/message.ts";

const log = new Logger({ prefix: "Main" });
let exitedBySigint = false;
let client: WssClient;

export class InvalidTokenError extends Error {
	constructor() {
		super("The token obtained during login is invalid.");
		this.name = "InvalidTokenError";
	}
}

/**
 * 程序主函数
 * @description 注意：先运行入口点函数！此函数会自行运行！
 */
export async function main(): Promise<void> {
	if (!hardwareRequirementsAssessment()) {
		log.error("未能通过配置检查！");
		log.warn("需求内存(MiB):", 512);
		log.warn("您的内存(MiB):", getMemToMiB());
		await exitClear();
		process.exit(1);
	}

	global.appConfig.account ??= {};

	const idAndPlatform = getIdAndPlatform(log);
	let hasConfiguredToken = Boolean(global.appConfig.account.token);
	let testData: TokenTest;

	if (hasConfiguredToken) {
		try {
			testData = await tokenTest(decryptToken(global.appConfig.account.token!, idAndPlatform.deviceId), log);
		} catch (e) {
			log.error(e);
			log.warn("Token 解密失败！尝试登录...");
			testData = await login();
		}
	} else {
		log.warn("未配置 token ，尝试登录...");
		testData = await login();
	}

	if (testData.success) {
		log.info(`登录成功。欢迎 ${testData.userName}(${testData.userId})。`);
		if (!global.appConfig.account.token) {
			global.appConfig.account.token = encryptToken(testData.token, idAndPlatform.deviceId);
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
			global.appConfig.account.token = encryptToken(testData.token, idAndPlatform.deviceId);
			persistConfig(log);
			global.accountData = testData;
		} else throw new InvalidTokenError();
	}

	if (global.appConfig.protocol.accessToken.trim() === "")
		log.warn("警告：protocol.accessToken 为空，可能存在盗号风险！");

	client = new WssClient({
		url: BASE_URL.ws + "ws",
		platform: idAndPlatform.platform,
		deviceId: idAndPlatform.deviceId,
		userId: global.accountData.userId.toString(),
		token: global.accountData.token,

		onOpen: () => log.info("WebSocket 已连接！"),
		onMessage: pushMessage,
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
	log.info("正在退出...");
	await closeServer();
	client?.destroy();
	log.info("Bye~");
}

process.on("SIGINT", async () => {
	log.info("收到 SIGINT 信号");
	await exitClear();
	process.exit(130);
});
