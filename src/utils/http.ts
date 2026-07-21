import type { ILogger } from "#/types.ts";
import type { ProtoMessage, InferProtoModel } from "@saltify/typeproto";
import { type Dispatcher, ProxyAgent, request as undiciRequest } from "undici";

/**
 * 读取 http_proxy 环境变量，存在则创建对应的代理 Dispatcher
 * 兼容大小写 (http_proxy / HTTP_PROXY / https_proxy / HTTPS_PROXY)
 */
function resolveProxyDispatcher(): Dispatcher | undefined {
	const proxyUrl =
		process.env.http_proxy ?? process.env.HTTP_PROXY ?? process.env.https_proxy ?? process.env.HTTPS_PROXY;
	if (!proxyUrl) return undefined;
	return new ProxyAgent(proxyUrl);
}

/** 进程级缓存的代理 Dispatcher，避免每次请求重复创建 */
const proxyDispatcher = resolveProxyDispatcher();

/**
 * HTTP 请求类型
 */
export type HttpResponse<T, E> =
	| { success: true; data: T }
	| { success: false; error: string; code: number; isObj: false; isError: false }
	| { success: false; error: E; code: number; isObj: true; isError: false }
	| { success: false; error: { name: string; message: string }; isError: true };

/**
 * HTTP 请求
 * @param url {string} 请求地址
 * @param options {Dispatcher.RequestOptions} undici request 选项 (method, headers, body 等)
 * @param log {ILogger} 日志
 * @param timeout {number} 超时时间 (默认 8000ms)
 * @param proto {ProtoMessage} 传入此参数以自动解析 ProtoBuf，T 必须 extends {@link ProtoMessage}
 */
export async function request<T extends ProtoMessage<any>, E = any>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod },
	log: ILogger,
	timeout: number,
	proto: T
): Promise<HttpResponse<InferProtoModel<T>, E>>;

/**
 * HTTP 请求
 * @param url {string} 请求地址
 * @param options {Dispatcher.RequestOptions} undici request 选项 (method, headers, body 等)
 * @param log {ILogger} 日志
 * @param timeout {number} 超时时间 (默认 8000ms)
 */
export async function request<T = any, E = any>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod },
	log: ILogger,
	timeout: number
): Promise<HttpResponse<T, E>>;

/**
 * HTTP 请求
 */
export async function request<T = any, E = any>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod } = {},
	log: ILogger,
	timeout: number = 8000,
	proto?: ProtoMessage<any>
): Promise<any> {
	// 原生超时信号
	const signal = AbortSignal.timeout(timeout);

	try {
		const response = await undiciRequest(url, {
			method: "GET",
			...options,
			signal,
			...(proxyDispatcher ? { dispatcher: proxyDispatcher } : {})
		});

		const status = response.statusCode;
		const ok = status >= 200 && status < 300;

		if (proto) {
			const arrayBuffer = await response.body.arrayBuffer();

			if (!ok) {
				log.error(`HTTP Error ${status}: ${url}`);
				return {
					success: false,
					code: status,
					error: `HTTP ${status}`,
					isObj: false,
					isError: false
				};
			}

			try {
				const data = proto.decode(Buffer.from(arrayBuffer));
				log.debug(`HTTP ${status} [protobuf -> json]: ${url}`);
				return { success: true, data };
			} catch (protoErr: unknown) {
				const { name, message } =
					protoErr instanceof Error ? protoErr : { name: "unknown error", message: "unknown message" };
				log.error(`ProtoBuf decode failed:`, protoErr);
				return {
					success: false,
					error: { name, message },
					isError: true
				};
			}
		}

		let responseData: unknown;
		let isObj: boolean;
		const text = await response.body.text();
		try {
			responseData = JSON.parse(text);
			isObj = true;
		} catch {
			responseData = text; // 如果不是 JSON，就返回纯文本
			isObj = false;
		}

		// 处理 HTTP 错误状态 (如 404, 500)
		if (!ok) {
			log.error(`HTTP Error ${status}: ${url}`, responseData);
			return isObj
				? {
						success: false,
						code: status,
						error: responseData as E,
						isObj: true,
						isError: false
					}
				: {
						success: false,
						code: status,
						error: (responseData as string) ?? `HTTP ${status}`,
						isObj: false,
						isError: false
					};
		}

		log.debug(`HTTP ${status}: ${url}`);
		// 请求成功
		return {
			success: true,
			data: responseData as T
		};
	} catch (error: unknown) {
		// 处理网络错误或超时
		const { name, message } = error instanceof Error ? error : { name: "UnknownError", message: "unknown message" };

		const isTimeout = name === "TimeoutError" || name === "AbortError";
		const errorMessage = isTimeout ? `请求超时。(${timeout}ms)` : message;

		log.error(url);
		log.error(`Request Failed:`, error);
		return {
			success: false,
			error: { name, message: errorMessage },
			isError: true
		};
	}
}
