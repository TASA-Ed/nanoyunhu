import { z } from "zod";

// ── Logger ───────────────────────────────────────────────────

/**
 * 日志级别数组
 */
export const LOG_LEVELS = ["trace", "debug", "info", "warn", "error"] as const;

/**
 * 日志级别类型
 */
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * ANSI 颜色
 */
export const Colors = {
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
} as const;

/**
 * Logger 初始化类型
 */
export type InitOptions = AppConfig["logger"];

/**
 * Logger 类设置类型
 */
export interface ILoggerOptions {
	// 日志等级 默认 info
	level?: LogLevel;
	// 命名空间 默认 空
	prefix?: string;
	// 是否以彩色输出 默认 true
	colorize?: boolean;
	// 遍历对象深度 默认 10
	maxDepth?: number;
	// 输出时间 默认 true
	timestamp?: boolean;
}

// ── Config ───────────────────────────────────────────────────

/**
 * 协议数组
 */
export const PROTOCOLS = ["satori"] as const;

/**
 * 协议类型
 */
export type Protocols = (typeof PROTOCOLS)[number];

/**
 * 平台数组
 */
export const PLATFORMS = ["windows", "macos", "android", "linux", "ios", "fuchsia", "Web"] as const;

/**
 * 平台类型
 */
export type Platforms = (typeof PLATFORMS)[number];

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
	)
});

/**
 * App 配置类型
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;

/**
 * 设备 ID 和 平台 类型
 */
export interface IdAndPlatform {
	readonly deviceId: string;
	readonly platform: Platforms;
}

// ── 网络 ───────────────────────────────────────────────────

export const BASE_URL = {
	v1: "https://chat-go.jwzhd.com/v1/",
	web: "https://chat-web-go.jwzhd.com/v1/",
	ws: "wss://chat-ws-go.jwzhd.com/"
} as const;

/** 当 HTTP 请求失败超 5 次时 */
export class HttpRequestFailedOn5Error extends Error {
	constructor(public readonly error: string) {
		super(`The HTTP request failed 5 times. The reason for the last failure was: ${error}.`);
		this.name = "HttpRequestFailedOn5Error";
	}
}

// ── 自身信息 ───────────────────────────────────────────────────

/**
 * 自身信息（V1 protobuf）
 */
export interface SelfInfoV1 {
	readonly status?: ProtoBase;
	readonly data?: SelfInfo;
}
/**
 * 自身信息（Web json）
 */
export interface SelfInfoWeb {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly user: {
			readonly userId: string;
			readonly nickname: string;
			readonly phone: string;
			readonly avatarId: string;
			readonly avatarUrl: string;
			readonly goldCoinAmount: number;
		};
	};
	readonly msg: string;
}

export interface ProtoBase {
	readonly trace: number;
	/** 请求状态码，1为正常 */
	readonly code: number;
	/** 返回消息 */
	readonly msg: string;
}

export interface WssClientMsgBase {
	/** 消息 ID */
	readonly id: string;
	/** 返回消息 */
	readonly cmd: string;
}

interface SelfInfo {
	readonly userId: string;
	readonly nickname: string;
	readonly avatar_url: string;
	readonly avatar_id: string | bigint;
	readonly phone: string;
	readonly email: string;
	readonly coin: number;
	readonly is_vip: number;
	readonly vip_expired_time: string | bigint;
	readonly invitation_code: string;
}

// ── 人机验证码 ───────────────────────────────────────────────────

/**
 * 人机验证码
 */
export type Captcha = {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly b64s: string;
		readonly id: string;
	};
	readonly msg: string;
};

// ── 邮箱登录 ───────────────────────────────────────────────────

/**
 * 邮箱登录
 */
export interface EmailLogin {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly token: string;
	};
	readonly msg: string;
}

// ── 手机登录 ───────────────────────────────────────────────────

/**
 * 手机登录
 */
export interface PhoneLogin {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly token: string;
	};
	readonly msg: string;
}

// ── 短信验证码 ───────────────────────────────────────────────────

/**
 * 短信验证码
 */
export interface MsgVerification {
	// 1 为成功
	readonly code: number;
	readonly msg: string;
}
