import { styleText } from "node:util";
import { loadConfigOnStarting } from "./config.ts";
import type { AppConfig } from "./types.ts";
import { initLogger, Logger } from "./utils/logger.ts";
import { main } from "./nanoYunHu/main.ts";
import type { TTokenTestSuccess } from "./nanoYunHu/login/token_test.ts";
import AppPackage from "../package.json" with { type: "json" };

export const Version = AppPackage.version.split(".");
export const AppName = "NanoYunHu" as const;

declare global {
	/**
	 * 全局配置
	 */
	var appConfig: AppConfig;
	/**
	 * 登录信息
	 */
	var accountData: TTokenTestSuccess;
}

/**
 * 程序入口点
 * @description 注意：先运行此函数！主函数会自行运行！
 */
export async function index(noCli: boolean): Promise<void> {
	console.log(styleText(["blue", "bold"], `    _   __   ___     _   __   ____ `));
	console.log(styleText(["blue", "bold"], `   / | / /  /   |   / | / /  / __ \\`));
	console.log(styleText(["blue", "bold"], `  /  |/ /  / /| |  /  |/ /  / / / /`));
	console.log(styleText(["blue", "bold"], ` / /|  /  / ___ | / /|  /  / /_/ / `));
	console.log(styleText(["blue", "bold"], `/_/ |_/  /_/  |_|/_/ |_/   \\____/  \n`));
	console.log(`${AppName} ${Version.join(".")}\n`);

	const log = new Logger({ prefix: "Entrypoint" });

	try {
		log.info("初始化...");
		global.appConfig = loadConfigOnStarting();

		initLogger(global.appConfig.logger);

		log.info("配置加载成功。");
		log.trace("已加载配置:", global.appConfig);
		log.info("启动中...");

		await main(noCli);
	} catch (error: any) {
		log.error(error);
		log.error("严重错误！正在停止...");
		process.exit(1);
	}
}

await index(process.env.NANO_ENV === "nocli");

export default index;
