import { z } from "zod";

// ── Logger ───────────────────────────────────────────────────

/**
 * 日志级别数组
 */
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const satisfies string[];

/**
 * 日志级别类型
 */
export type TLogLevel = (typeof LOG_LEVELS)[number];

/**
 * ANSI 颜色
 */
export const COLORS = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	magenta: "\x1b[35m",
	gray: "\x1b[90m",
	white: "\x1b[37m",
	bold: "\x1b[1m",
	boldRed: "\x1b[1;31m",
	boldYellow: "\x1b[1;33m",
	boldBlue: "\x1b[1;34m",
	boldCyan: "\x1b[1;36m",
	clearLine: "\x1b[2K\x1b[1A"
} as const satisfies Record<string, string>;

/**
 * Logger 初始化类型
 */
export type TInitOptions = AppConfig["logger"];

/**
 * Logger 类设置类型
 */
export interface ILoggerOptions {
	// 日志等级 默认 info
	level?: TLogLevel;
	// 命名空间 默认 空
	prefix?: string;
	// 是否以彩色输出 默认 true
	colorize?: boolean;
	// 遍历对象深度 默认 10
	maxDepth?: number;
	// 输出时间 默认 true
	timestamp?: boolean;
}

export interface ILogger {
	trace(...args: unknown[]): void;
	debug(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
	error(...args: unknown[]): void;
	/** 创建一个带子前缀的子 Logger */
	child(prefix: string): ILogger;
	/** 动态设置最低日志级别 */
	setLevel(level: TLogLevel): void;
}

// ── Config ───────────────────────────────────────────────────

/**
 * 协议数组
 */
export const PROTOCOLS = ["satori"] as const satisfies string[];

/**
 * 协议类型
 */
export type TProtocols = (typeof PROTOCOLS)[number];

/**
 * 平台数组
 */
export const PLATFORMS = ["windows", "macos", "android", "linux", "ios", "fuchsia", "Web"] as const satisfies string[];

/**
 * 平台类型
 */
export type TPlatforms = (typeof PLATFORMS)[number];

/**
 * App 配置 Schema
 */
export const AppConfigSchema = z.object({
	// 配置文件版本
	$version: z
		.number("配置文件版本 必须为数字")
		.min(1, "配置文件版本 必须是 >= 1 的整数")
		.max(65535, "配置文件版本 必须是 <= 65535 的整数"),
	// 监听地址
	host: z.string("监听地址 必须为字符串").nonempty("监听地址 不能为空"),
	// 端口
	port: z.number("端口 必须为数字").min(1, "端口 必须是 >= 1 的整数").max(65535, "端口 必须是 <= 65535 的整数"),
	// 协议
	protocol: z.object({
		// 协议类型
		type: z.enum(PROTOCOLS, `协议类型 必须为 ${PROTOCOLS.join(" | ")} 之一`),
		// 访问密钥 默认 64 位随机密钥
		accessToken: z.string("访问密钥 必须为字符串")
	}),
	// logger
	logger: z.object(
		{
			// 语言 如 zh-CN
			locale: z.string("语言 必须为字符串").nonempty("语言 不能为空"),
			// 日志等级
			level: z.enum(LOG_LEVELS, `日志等级 必须为 ${LOG_LEVELS.join(" | ")} 之一`).optional(),
			// 时区 默认 系统时区
			timeZone: z.string("时区 必须为字符串").nonempty("时区 不能为空").optional(),
			// 是否以彩色输出 默认 true
			colorize: z.boolean("时区 必须为布尔值").optional()
		},
		"logger 必须为对象"
	),
	// 账号
	account: z
		.object(
			{
				// 账号 token
				token: z.string("token 必须为字符串").nonempty("token 不能为空").optional(),
				// 设备名 默认 <随机字符串>
				device: z.string("设备名 必须为字符串").nonempty("设备名 不能为空").optional(),
				// 平台名 默认 当前平台
				platform: z.enum(PLATFORMS, `平台名 必须为 ${PLATFORMS.join(" | ")} 之一`).optional()
			},
			"account 必须为对象"
		)
		.optional(),
	// 网络
	network: z.object(
		{
			// Http 请求超时时间(毫秒) 默认 8000
			httpTimeoutMs: z.number("Http 请求超时时间(毫秒) 必须为数字").min(1000, "Http 请求超时时间(毫秒) 最小为 1000"),
			// WebSocket 心跳包时间(毫秒)
			websocketHeartbeatIntervalMs: z
				.number("WebSocket 心跳包时间(毫秒) 必须为数字")
				.min(1000, "WebSocket 心跳包时间(毫秒) 最小为 1000"),
			// WebSocket 断线重连时间(毫秒)
			websocketReconnectDelayMs: z
				.number("WebSocket 断线重连时间(毫秒) 必须为数字")
				.min(0, "WebSocket 断线重连时间(毫秒) 最小为 0")
		},
		"network 必须为对象"
	),
	// 消息
	message: z.object(
		{
			// 消息持久化选项
			persistence: z.boolean("消息持久化选项 必须为布尔值")
		},
		"message 必须为对象"
	)
});

/**
 * App 配置类型
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * 设备 ID 和 平台 类型
 */
export type TIdAndPlatform = {
	readonly deviceId: string;
	readonly platform: TPlatforms;
};

// ── 网络 ───────────────────────────────────────────────────

/**
 * 云湖 API 的基地址
 */
export const BASE_URL = {
	v1: "https://chat-go.jwzhd.com/v1/",
	web: "https://chat-web-go.jwzhd.com/v1/",
	ws: "wss://chat-ws-go.jwzhd.com/"
} as const satisfies Record<string, string>;

/** 当 HTTP 请求失败超 5 次时 */
export class HttpRequestFailedOn5Error extends Error {
	constructor(public readonly error: string) {
		super(`The HTTP request failed 5 times. The reason for the last failure was: ${error}.`);
		this.name = "HttpRequestFailedOn5Error";
	}
}

/**
 * ProtoBuf Base
 */
export type TProtoBase = {
	readonly trace: number;
	/** 请求状态码，1为正常 */
	readonly code: number;
	/** 返回消息 */
	readonly msg: string;
};

/**
 * Web 请求失败
 */
export type TWebRequestFailed = {
	readonly code: number;
	readonly msg: string;
};

/**
 * V1 请求失败（protobuf）
 */
export type TV1RequestFailed = {
	readonly status?: TProtoBase;
};
