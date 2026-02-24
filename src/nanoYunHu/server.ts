import Fastify from 'fastify';
import type { AddressInfo } from 'node:net';
import { Logger } from "../utils/logger.js";

export const server = Fastify();

const log = new Logger({ prefix: 'Server' });

/**
 * 启动服务器
 * @param port 端口
 * @return 端口
 */
export async function startServer( port?: number | undefined ):Promise<number | undefined> {
	try {
		await server.listen({ port: port, host: global.appConfig.host });
		const address = server.server.address();
		const p = typeof address === 'string' ? undefined : (address as AddressInfo | null)?.port;
		log.info(`服务器已启用: http://${global.appConfig.host}:${p}`);
		return p;
	} catch (err) {
		log.error(`启动服务器失败 (${global.appConfig.host}:${global.appConfig?.port}):`);
		throw err;
	}
}
