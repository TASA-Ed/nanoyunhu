import { Logger } from "#/utils/logger.ts";
import { tokenTestV1, TTokenTest } from "./login/token_test.ts";
import { persistConfig } from "#/core/config.ts";
import { WssClient } from "#/utils/wss.ts";
import { closeServer, server, startServer } from "#/utils/server.ts";
import { registerProtocol } from "./protocols/protocols.ts";
import { BASE_URL } from "#/types.ts";
import { encryptToken, decryptToken } from "./login/token_crypto.ts";
import { getIdAndPlatform, getMemToMiB, hardwareRequirementsAssessment } from "#/utils/device.ts";
import { wssClientMessage } from "./message/message.ts";
import type { Context } from "#/core/context.ts";

const log = new Logger({ prefix: "Main" });
let exitedBySigint = false;
let client: WssClient;

/**
 * 程序主函数
 * @description 需初始化。可先运行 {@link nanoRun} 函数，此函数会自行运行。
 */
export async function main(ctx: Context): Promise<void> {
	if (!hardwareRequirementsAssessment()) {
		log.error("未能通过配置检查！");
		log.warn("需求内存(MiB):", 512);
		log.warn("您的内存(MiB):", getMemToMiB());
		await exitClear();
		process.exit(1);
	}

	log.debug("进程 Pid:", process.pid);
	ctx.appConfig.account ??= {};

	const idAndPlatform = getIdAndPlatform(ctx, log);

	if (ctx.appConfig.account.token) {
		try {
			const testData: TTokenTest = await tokenTestV1(
				decryptToken(ctx, ctx.appConfig.account.token, idAndPlatform.deviceId),
				log
			);
			if (testData.success) {
				log.info(`登录成功。欢迎 ${testData.userName}(${testData.userId})。`);
				if (!ctx.appConfig.account.token) {
					ctx.appConfig.account.token = encryptToken(testData.token, idAndPlatform.deviceId);
					persistConfig(ctx, log);
				}
				ctx.accountData = testData;
			} else {
				log.error("配置的 Token 无效！");
				await exitClear();
				process.exit(1);
			}
		} catch (e) {
			log.error(e);
			log.error("Token 解密失败！");
			await exitClear();
			process.exit(1);
		}
	} else {
		log.error("未配置 Token!");
		await exitClear();
		process.exit(1);
	}

	if (ctx.appConfig.protocol.accessToken.trim() === "") {
		log.error("protocol.accessToken 不得为空。");
		await exitClear();
		process.exit(1);
	}

	client = new WssClient(ctx, {
		url: BASE_URL.ws + "ws",
		platform: idAndPlatform.platform,
		deviceId: idAndPlatform.deviceId,
		userId: ctx.accountData.userId,
		token: ctx.accountData.token,

		onOpen: (_ctx) => log.info("WebSocket 已连接！"),
		onMessage: wssClientMessage,
		onClose: (_ctx, code, reason) => log.warn(`Websocket 关闭 ${code}: ${reason}`),
		onError: (_ctx, err) => log.error("Websocket 错误:", err.message)
	});

	await client.connect();

	server.register(registerProtocol, { protocol: ctx.appConfig.protocol.type, ctx: ctx });
	await startServer(ctx, ctx.appConfig.port);
}

/**
 * 程序退出时清理工作
 * @description 注意：执行完此函数后仍然需要执行 {@link NodeJS.Process.exit}
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
