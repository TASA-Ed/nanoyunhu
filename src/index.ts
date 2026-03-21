import { styleText } from "node:util";
import { loadConfigOnStarting } from "./config.ts";
import type { AppConfig } from "./types.ts";
import { initLogger, Logger } from "./utils/logger.ts";
import { main } from "./nanoYunHu/main.ts";
import type { TokenTestSuccess } from "./nanoYunHu/token_test.ts";

export const Version = [0, 3, 0] as const;
export const AppName = "NanoYunHu" as const;

declare global {
	/**
	 * 全局配置
	 */
	var appConfig: AppConfig;
	/**
	 * 登录信息
	 */
	var accountData: TokenTestSuccess;
}

/**
 * 程序入口点
 * @description 注意：先运行此函数！主函数会自行运行！
 */
export async function index(): Promise<void> {
	console.info(styleText(["blue", "bold"], `\n| ${AppName} |\n`));
	console.info("初始化...\n");

	const log = new Logger({ prefix: "Entrypoint" });

	try {
		global.appConfig = loadConfigOnStarting();

		initLogger(global.appConfig.logger);

		log.info("配置加载成功。");
		log.debug("已加载配置:", global.appConfig);
		log.info(`${AppName} 版本：${Version.join(".")}`);
		log.info(`启动中...`);

		await main();
	} catch (error: any) {
		log.error(error);
		log.error("严重错误！正在停止...");
		process.exit(1);
	}
}

await index();

export default index;
