// Logger

/**
 * 日志级别数组
 */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
/**
 * 日志级别类型
 */
export type LogLevel = typeof LOG_LEVELS[number];
/**
 * ANSI 颜色
 */
export const Colors = {
	reset: '\x1b[0m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	green: '\x1b[32m',
	magenta: '\x1b[35m',
	gray: '\x1b[90m',
	white: '\x1b[37m',
	bold: '\x1b[1m',
	boldRed: '\x1b[1;31m',
	boldYellow: '\x1b[1;33m',
	boldBlue: '\x1b[1;34m',
	boldCyan: '\x1b[1;36m',
	clearLine: '\x1b[2K\x1b[1A'
} as const;
/**
 * AppConfig.logger 配置类型
 */
export interface InitOptions {
	// 语言 如 zh-CN
	locale: string;
	// 日志等级
	level?: LogLevel;
	// 时区 默认 系统时区
	timeZone?: string;
	// 是否以彩色输出 默认 true
	colorize?: boolean;
}
/**
 *
 */
export interface LoggerOptions {
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

// Config

/**
 * App 配置类型
 */
export interface AppConfig {
	// host 监听地址
	host: string;
	// port 端口
	port: number;
	// logger
	logger: InitOptions;
	// account 账号
	account?: {
		// 账号 token
		token?: string;
	};
}

// Cmd

export type SelectChoices = { label: string; value: string }[];

// login

export const LoginMode: SelectChoices = [
	{ label: "邮箱登录", value: "email"},
	{ label: "手机登录", value: "phone"}
] as const;

// 网络

/** 当 HTTP 请求失败超 5 次时 */
export class HttpRequestFailedOn5Error extends Error {
	constructor(public readonly error: string) {
		super(`HTTP 请求失败达 5 次，最后请求失败原因：${error}。`);
		this.name = "HttpRequestFailedOn5Error";
	}
}

// - 用户信息 -

/**
 * 用户信息（V1）
 */
export interface UserInfoV1 {
	status?: Status;
	data?: UserInfo;
}
/**
 * 用户信息（Web）
 */
export interface UserInfoWeb {
	code: number;
	data: {
		user: {
			userId: string;
			nickname: string;
			phone: string;
			avatarId: string;
			avatarUrl: string;
			goldCoinAmount: number;
		};
	};
	msg: string;
}

interface Status {
	number: number;
	code: number;
	msg: string;
}

interface UserInfo {
	userId: string;
	nickname: string;
	avatar_url: string;
	avatar_id: string | bigint;
	phone: string;
	email: string;
	coin: number;
	is_vip: number;
	vip_expired_time: string | bigint;
	invitation_code: string;
}

// 验证码

export type Captcha = {
	code: number;
	data: {
		b64s: string;
		id: string;
	};
	msg: string;
}

// 邮箱登录

export interface EmailLogin {
	code: number;
	data: {
		token: string;
	};
	msg: string;
}
