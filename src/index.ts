import { styleText } from "node:util";
import { loadConfigOnStarting } from "./config.ts";
import { initLogger, Logger } from "./utils/logger.ts";
import { main } from "./nano_yunhu/main.ts";
import { parseArgs, ParseArgsOptionsConfig } from "node:util";
import { existsSync } from "node:fs";
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
	} catch (error) {
		log.error(error);
		log.error("严重错误！正在停止...");
		process.exit(1);
	}
}

export default nanoRun;

const options = {
	workdir: {
		type: "string",
		short: "w",
		default: process.cwd()
	},
	nocli: {
		type: "boolean",
		default: false,
		short: "n"
	},
	help: {
		type: "boolean",
		default: false,
		short: "h"
	},
	version: {
		type: "boolean",
		default: false,
		short: "v"
	}
} as const satisfies ParseArgsOptionsConfig;

const { values } = parseArgs({
	args: process.argv.slice(2),
	options
});

if (values.help) {
	console.log(`Usage: nanoyunhu [option]
Options:
  -h, --help               show help information.
  -v, --version            show nanoyunhu version.

  -w, --workdir < DIR >    specify a working directory.
  -n, --nocli              enable non-interactive mode(takes precedence over the NANO_ENV environment variable).`);
} else if (values.version) {
	console.log("NanoYunHu", AppPackage.version);
	console.log("Node", process.versions.node);
	console.log("V8", process.versions.v8);
	if (process.versions.electron) console.log("Electron", process.versions.electron);
} else {
	const workdir = existsSync(values.workdir) ? values.workdir : process.cwd();
	const nocli = values.nocli || process.env.NANO_ENV === "nocli";

	await nanoRun(nocli, workdir);
}
