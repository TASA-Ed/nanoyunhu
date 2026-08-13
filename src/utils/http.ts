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

/** 从响应头中提取并标准化 MIME 类型 */
function extractMimeType(headers: Record<string, string | string[] | undefined>): string {
	const contentTypeHeader = headers["content-type"];
	const rawMimeType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
	return rawMimeType?.trim().toLowerCase() ?? "application/octet-stream";
}

/** 判断 MIME 类型是否为 JSON */
function isJsonMimeType(mimeType: string): boolean {
	return mimeType.includes("application/json") || mimeType.includes("application/ld+json");
}

/**
 * HTTP 请求类型
 * - `kind: "http"`    HTTP 状态码非 2xx
 * - `kind: "network"` 网络错误 / 超时 / ProtoBuf 解码失败
 */
export type HttpResponse<T, E = unknown> =
	| { success: true; data: T; mimeType: string }
	| { success: false; kind: "http"; code: number; error: E | string; mimeType: string }
	| { success: false; kind: "network"; error: { name: string; message: string } };

type BodyReadable = Dispatcher.ResponseData["body"];

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
 * HTTP 请求实现
 */
export async function request<T = unknown, E = unknown>(
	url: string,
	options: Omit<Dispatcher.RequestOptions, "origin" | "path" | "method"> & { method?: Dispatcher.HttpMethod } = {},
	log: ILogger,
	timeout: number = 8000,
	proto?: ProtoMessage<any>
): Promise<HttpResponse<T, E>> {
	const signal = AbortSignal.timeout(timeout);

	try {
		const response = await undiciRequest(url, {
			method: "GET",
			...options,
			signal,
			...(proxyDispatcher && { dispatcher: proxyDispatcher })
		});

		const status = response.statusCode;
		const ok = status >= 200 && status < 300;
		const mimeType = extractMimeType(response.headers);

		if (proto) {
			const protoResult = await handleProtoResponse(response.body, status, ok, mimeType, url, log, proto);
			return protoResult as HttpResponse<T, E>;
		}

		const { data, isStructured } = await parseResponseBody(response.body, mimeType);

		if (!ok) {
			log.error(`HTTP Error ${status}: ${url}`, data);
			const error = isStructured ? (data as E) : (data as string) || `HTTP ${status}`;
			return { success: false, kind: "http", code: status, error, mimeType };
		}

		log.debug(`HTTP ${status}: ${url}`);
		return { success: true, data: data as T, mimeType };
	} catch (error: unknown) {
		const { name, message } = toNameMessage(error);
		const isTimeout = name === "TimeoutError" || name === "AbortError";
		const errorMessage = isTimeout ? `请求超时。(${timeout}ms)` : message;

		log.error(url);
		log.error(`Request Failed:`, error);
		return { success: false, kind: "network", error: { name, message: errorMessage } };
	}
}

/** 处理 ProtoBuf 响应 */
async function handleProtoResponse(
	body: BodyReadable,
	status: number,
	ok: boolean,
	mimeType: string,
	url: string,
	log: ILogger,
	proto: ProtoMessage<any>
): Promise<HttpResponse<any>> {
	const arrayBuffer = await body.arrayBuffer();

	if (!ok) {
		log.error(`HTTP Error ${status}: ${url}`);
		return { success: false, kind: "http", code: status, error: `HTTP ${status}`, mimeType };
	}

	try {
		const raw = Buffer.from(arrayBuffer);
		if (log.level === "trace") log.trace("Raw Hex:", raw.toString("hex"));
		const data = proto.decode(raw);
		log.debug(`HTTP ${status} [protobuf -> json]: ${url}`);
		return { success: true, data, mimeType };
	} catch (protoErr: unknown) {
		const { name, message } = toNameMessage(protoErr);
		log.error(`ProtoBuf decode failed:`, protoErr);
		return { success: false, kind: "network", error: { name, message } };
	}
}

/** 解析响应体，返回数据和是否为结构化类型 */
async function parseResponseBody(
	body: BodyReadable,
	mimeType: string
): Promise<{ data: unknown; isStructured: boolean }> {
	if (isJsonMimeType(mimeType)) {
		const text = await body.text();
		try {
			return { data: JSON.parse(text), isStructured: true };
		} catch {
			return { data: text, isStructured: false };
		}
	}

	if (mimeType.startsWith("text/")) {
		return { data: await body.text(), isStructured: false };
	}

	return { data: await body.arrayBuffer(), isStructured: true };
}
