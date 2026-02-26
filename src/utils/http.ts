import { Logger } from "./logger.js";
import protobuf from "protobufjs";
// 上游 https://github.com/ccd2s/node-async-bot-all/blob/master/src/fun.ts

// HTTP 请求类型
export type HttpResponse<T> =
	| { success: true; data: T; }
	| { success: false; error: any; code?: number; isJson: boolean };

/**
 * ProtoBuf 解析选项
 */
export interface ProtoOptions {
	/** .proto 文件路径 */
	protoFile: string;
	/** 消息类型名称（如 "MyMessage" 或 "mypackage.MyMessage"） */
	messageType: string;
}

/**
 * 将 ProtoBuf 二进制数据解析为 JSON 对象
 * @param buffer 原始二进制数据
 * @param opts ProtoOptions
 * @returns 解析后的普通对象
 */
export async function parseProtobuf<T = any>(
	buffer: ArrayBuffer | Uint8Array,
	opts: ProtoOptions
): Promise<T> {
	const root = await protobuf.load(opts.protoFile);
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
		oneofs: true,
	}) as T;
}

/**
 * HTTP 请求
 * @param url 请求地址
 * @param options fetch 选项 (method, headers, body 等)
 * @param timeout 超时时间 (默认 8000ms)
 * @param log 日志
 * @param proto 可选，若响应体为 ProtoBuf 二进制，传入此参数自动解析为 JSON
 */
export async function request<T = any>(
	url: string,
	options: RequestInit = {},
	timeout: number = 8000,
	log: Logger,
	proto?: ProtoOptions
): Promise<HttpResponse<T>> {

	// 原生超时信号
	const signal = AbortSignal.timeout(timeout);

	try {
		const response = await fetch(url, { ...options, signal });

		if (proto) {
			const arrayBuffer = await response.arrayBuffer();

			if (!response.ok) {
				log.error(`HTTP Error ${response.status}: ${url}`);
				return {
					success: false,
					code: response.status,
					error: `HTTP ${response.status}`,
					isJson: false,
				};
			}

			try {
				const data = await parseProtobuf<T>(arrayBuffer, proto);
				log.debug(`HTTP ${response.status} [protobuf -> json]: ${url}`);
				return { success: true, data };
			} catch (protoErr: any) {
				log.error(`ProtoBuf decode failed: ${protoErr.message}`);
				return {
					success: false,
					error: { name: protoErr.name, message: protoErr.message },
					isJson: false,
				};
			}
		}

		let responseData: any;
		let isJson: boolean;
		const text = await response.text();
		try {
			responseData = JSON.parse(text);
			isJson = true;
		} catch {
			responseData = text; // 如果不是 JSON，就返回纯文本
			isJson = false;
		}

		// 处理 HTTP 错误状态 (如 404, 500)
		if (!response.ok) {
			log.error(`HTTP Error ${response.status}: ${url}`, responseData);
			return {
				success: false,
				code: response.status,
				error: responseData || `HTTP ${response.status}`,
				isJson: isJson
			};
		}

		log.debug(`HTTP ${response.status}: ${url}`);
		// 请求成功
		return {
			success: true,
			data: responseData as T
		};

	} catch (error: any) {
		// 处理网络错误或超时
		const isTimeout = error.name === 'TimeoutError' || error.name === 'AbortError';
		const errorMessage = isTimeout ? `请求超时。(${timeout}ms)` : error.message;

		log.error(url);
		log.error(`Request Failed: ${errorMessage}`);

		return {
			success: false,
			error: { name: error.name, message: errorMessage },
			isJson: false
		};
	}
}
