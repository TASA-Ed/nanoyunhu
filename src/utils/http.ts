import type { ILogger } from "#/types.ts";
import type { ProtoMessage, InferProtoModel } from "@saltify/typeproto";
import { type Dispatcher, ProxyAgent, request as undiciRequest } from "undici";

/**
 * 读取 http_proxy 环境变量，存在则创建对应的代理 Dispatcher
 * 兼容大小写 (http_proxy / HTTP_PROXY / https_proxy / HTTPS_PROXY)
 */
function resolveProxyDispatcher(): Dispatcher | undefined {
	const proxyUrl =
		process.env.http_proxy || process.env.HTTP_PROXY || process.env.https_proxy || process.env.HTTPS_PROXY;
	return proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
}

/** 进程级缓存的代理 Dispatcher，避免每次请求重复创建 */
const proxyDispatcher = resolveProxyDispatcher();

/** 统一提取 name/message，兼容非 Error 类型的异常值 */
function toNameMessage(error: unknown): { name: string; message: string } {
	return error instanceof Error
		? { name: error.name, message: error.message }
		: { name: "UnknownError", message: "unknown message" };
}

/**
 * HTTP 请求类型
 * - `kind: "http"`    HTTP 状态码非 2xx；`isObj` 区分响应体是否被解析为 JSON
 * - `kind: "network"` 网络错误 / 超时 / ProtoBuf 解码失败
 */
export type HttpResponse<T, E = unknown> =
	| { success: true; data: T }
	| { success: false; kind: "http"; code: number; isObj: true; error: E }
	| { success: false; kind: "http"; code: number; isObj: false; error: string }
	| { success: false; kind: "network"; error: { name: string; message: string } };

/**
 * HTTP 请求
 * @param url {string} 请求地址
 * @param options {Dispatcher.RequestOptions} undici request 选项 (method, headers, body 等)
 * @param log {ILogger} 日志
 * @param timeout {number} 超时时间 (默认 8000ms)
 * @param proto {ProtoMessage} 传入此参数以自动解析 ProtoBuf，T 必须 extends {@link ProtoMessage}
 */
export async function request<T extends ProtoMessage<any>, E = unknown>(
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
export async function request<T = unknown, E = unknown>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod },
	log: ILogger,
	timeout: number
): Promise<HttpResponse<T, E>>;

/**
 * HTTP 请求
 */
export async function request<T = unknown, E = unknown>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod } = {},
	log: ILogger,
	timeout: number = 8000,
	proto?: ProtoMessage<any>
): Promise<HttpResponse<T, E>> {
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
				return { success: false, kind: "http", code: status, isObj: false, error: `HTTP ${status}` };
			}

			try {
				const data = proto.decode(Buffer.from(arrayBuffer)) as T;
				log.debug(`HTTP ${status} [protobuf -> json]: ${url}`);
				return { success: true, data };
			} catch (protoErr: unknown) {
				const { name, message } = toNameMessage(protoErr);
				log.error(`ProtoBuf decode failed:`, protoErr);
				return { success: false, kind: "network", error: { name, message } };
			}
		}

		const text = await response.body.text();
		let responseData: unknown;
		let isObj: boolean;
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
				? { success: false, kind: "http", code: status, isObj: true, error: responseData as E }
				: {
						success: false,
						kind: "http",
						code: status,
						isObj: false,
						error: (responseData as string) || `HTTP ${status}`
					};
		}

		log.debug(`HTTP ${status}: ${url}`);
		// 请求成功
		return { success: true, data: responseData as T };
	} catch (error: unknown) {
		// 处理网络错误或超时
		const { name, message } = toNameMessage(error);

		const isTimeout = name === "TimeoutError" || name === "AbortError";
		const errorMessage = isTimeout ? `请求超时。(${timeout}ms)` : message;

		log.error(url);
		log.error(`Request Failed:`, error);
		return { success: false, kind: "network", error: { name, message: errorMessage } };
	}
}
