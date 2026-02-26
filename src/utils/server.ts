import Fastify from 'fastify';
import type { AddressInfo } from 'node:net';
import { Logger } from "./logger.js";

export let server = Fastify();

const log = new Logger({ prefix: 'Server' });

function getListeningPort(): number | undefined {
	const address = server.server.address();
	return typeof address === 'string' ? undefined : (address as AddressInfo | null)?.port;
}

/**
 * 启动服务器
 * @param port 端口
 * @return 端口
 */
export async function startServer( port: number = 0 ):Promise<number | undefined> {
	try {
		if (server.server.listening) {
			const p = getListeningPort();
			log.debug(`服务器已在运行: http://${global.appConfig.host}:${p}`);
			return p;
		}
		// global.appConfig.host 是必须配置，应该不需要做验证
		await server.listen({ port: port, host: global.appConfig.host });
		const p = getListeningPort();
		log.info(`服务器已启用: http://${global.appConfig.host}:${p}`);
		return p;
	} catch (err) {
		log.error(`启动服务器失败 (${global.appConfig.host}:${port}):`, err);
		throw err;
	}
}

/**
 * 关闭服务器并重新创建一个
 */
export async function closeAndRestartServer():Promise<void> {
	try {
		if (server.server.listening) {
			await server.close();
			log.debug("服务器关闭。");
		} else log.debug("服务器未运行，跳过关闭。");

		server = Fastify();
	} catch (err) {
		log.error(`关闭服务器失败:`, err);
		throw err;
	}
}
