import { styleText } from 'node:util';
import { loadConfigOnStarting } from './config.js';
import { AppConfig } from './types.js';
import { initLogger, Logger } from './utils/logger.js';
import { main } from './nanoYunHu/main.js';

export const Version = [0,1,0] as const;
export const AppName = "NanoYunHu" as const;

declare global {
  type appConfig = AppConfig | undefined;
}

export async function index(): Promise<void> {
	console.info(styleText(['blue', 'bold'], `\n| ${AppName} |\n`));
	console.info("初始化...\n");

	const log = new Logger({ prefix: 'Entrypoint' });

	try {
		global.appConfig = loadConfigOnStarting();

		initLogger(global.appConfig.logger);

		log.info('配置加载成功。');
		log.debug('已加载配置:', global.appConfig);
		log.info(`${AppName} 版本：${Version.join(".")}`);
		log.info(`启动中...`);

		await main();
	} catch (error: any) {
		log.error(error);
		log.error("严重错误！正在停止...");
		global.appConfig = undefined
		process.exit(255);
	}
}

await index();

export default index;
