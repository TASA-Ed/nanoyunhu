import type { ILogger } from "#/types.ts";
import protobuf from "protobufjs";
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
 * ProtoBuf 解析选项
 */
export interface IProtoOptions {
	/** .proto 文件内容 */
	protoFile: string;
	/** 消息类型名称（如 "MyMessage" 或 "mypackage.MyMessage"） */
	messageType: string;
}

/**
 * 将 ProtoBuf 二进制数据解析为 JSON 对象
 * @param buffer {ArrayBuffer} 原始二进制数据
 * @param opts {IProtoOptions} ProtoBuf 解析选项
 * @returns 解析后的普通对象
 */
export async function parseProtobuf<T = any>(buffer: ArrayBuffer | Uint8Array, opts: IProtoOptions): Promise<T> {
	const root = protobuf.parse(opts.protoFile).root;
	const MsgType = root.lookupType(opts.messageType);
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	const decoded = MsgType.decode(bytes);
	// toObject 将 Long、bytes 等转为普通 JS 类型
	return MsgType.toObject(decoded, {
		longs: String,
		enums: String,
		bytes: String,
		defaults: true,
		arrays: true,
		objects: true,
		oneofs: true
	}) as T;
}

/**
 * HTTP 请求
 * @param url {string} 请求地址
 * @param options {Dispatcher.RequestOptions} undici request 选项 (method, headers, body 等)
 * @param timeout {number} 超时时间 (默认 8000ms)
 * @param log {ILogger} 日志
 * @param proto {IProtoOptions} 可选，若响应体为 ProtoBuf 二进制，传入此参数自动解析为 JSON
 */
export async function request<T = any, E = any>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod } = {},
	timeout: number = 8000,
	log: ILogger,
	proto?: IProtoOptions
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
				return {
					success: false,
					code: status,
					error: `HTTP ${status}`,
					isObj: false,
					isError: false
				};
			}

			try {
				const data = await parseProtobuf<T>(arrayBuffer, proto);
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
