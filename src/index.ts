import { styleText } from "node:util";
import { loadConfigOnStarting } from "./config.ts";
import { initLogger, Logger } from "./utils/logger.ts";
import { main } from "./nano_yunhu/main.ts";
import AppPackage from "../package.json" with { type: "json" };

export const VERSION = AppPackage.version.split(".");
export const APP_NAME = "NanoYunHu" as const;

/**
 * 程序入口点
 * @description 注意：先运行此函数！{@link main} 函数会自行运行！
 */
export async function nanoRun(noCli: boolean, workdir?: string): Promise<void> {
	console.log(styleText(["blue", "bold"], `    _   __   ___     _   __   ____ `));
	console.log(styleText(["blue", "bold"], `   / | / /  /   |   / | / /  / __ \\`));
	console.log(styleText(["blue", "bold"], `  /  |/ /  / /| |  /  |/ /  / / / /`));
	console.log(styleText(["blue", "bold"], ` / /|  /  / ___ | / /|  /  / /_/ / `));
	console.log(styleText(["blue", "bold"], `/_/ |_/  /_/  |_|/_/ |_/   \\____/  \n`));
	console.log(`${APP_NAME} ${VERSION.join(".")}\n`);

	const log = new Logger({ prefix: "Entrypoint" });

	try {
		log.info("初始化...");
		if (workdir) process.chdir(workdir);
		global.appConfig = loadConfigOnStarting();

		initLogger(global.appConfig.logger);

		log.info("配置加载成功。");
		log.debug("工作目录:", process.cwd());
		log.trace("已加载配置:", global.appConfig);
		log.info("启动中...");

		await main(noCli);
	} catch (error: any) {
		log.error(error);
		log.error("严重错误！正在停止...");
		process.exit(1);
	}
}

export default nanoRun;
