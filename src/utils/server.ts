import Fastify from "fastify";
import type { AddressInfo } from "node:net";
import { Logger } from "./logger.ts";
import type { Context } from "#/core/context.ts";

/**
 * 全局单例服务器
 */
export let server = Fastify({ forceCloseConnections: true });

const log = new Logger({ prefix: "Server" });

function getListeningPort(): number | undefined {
	const address = server.server.address();
	return typeof address === "string" ? undefined : (address as AddressInfo | null)?.port;
}

/**
 * 启动服务器
 * @param ctx 上下文
 * @param port 端口
 * @returns 端口
 */
export async function startServer(ctx: Context, port: number = 0): Promise<number | undefined> {
	try {
		if (server.server.listening) {
			const listeningPort = getListeningPort();
			log.debug(`服务器已在运行: http://${ctx.appConfig.host}:${listeningPort}`);
			return listeningPort;
		}
		// ctx.appConfig.host 是必须配置，应该不需要做验证
		await server.listen({ port: port, host: ctx.appConfig.host });
		const listeningPort = getListeningPort();
		log.info(`服务器已启用: http://${ctx.appConfig.host}:${listeningPort}`);
		return listeningPort;
	} catch (err) {
		log.error(`启动服务器失败 (${ctx.appConfig.host}:${port}):`, err);
		throw err;
	}
}

/**
 * 关闭服务器并重新创建一个
 * @deprecated 可能已不再需要。
 */
export async function closeAndRestartServer(): Promise<void> {
	try {
		if (server.server.listening) {
			await server.close();
			log.debug("服务器关闭。");
		} else log.debug("服务器未运行，跳过关闭。");

		server = Fastify({ forceCloseConnections: true });
	} catch (err) {
		log.error(`关闭服务器失败:`, err);
		throw err;
	}
}

/**
 * 关闭服务器
 */
export async function closeServer(): Promise<void> {
	try {
		if (server.server.listening) {
			await server.close();
			log.info("服务器关闭。");
		} else log.debug("服务器未运行，跳过关闭。");
	} catch (err) {
		log.error(`关闭服务器失败:`, err);
	}
}
