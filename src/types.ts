import { z } from 'zod';

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
 * Logger 初始化类型
 */
export type InitOptions = AppConfig['logger'];

/**
 * Logger 类设置类型
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
 * App 配置 Schema
 */
export const AppConfigSchema = z.object({
	// 监听地址
	host: z.string('监听地址 必须为字符串').nonempty('监听地址 不能为空'),
	// 端口
	port: z
		.number('端口 必须为数字')
		.min(1, '端口 必须是 >= 1 的整数')
		.max(65535, '端口 必须是 <= 65535 的整数'),
	// logger
	logger: z.object({
			// 语言 如 zh-CN
			locale: z.string('语言 必须为字符串').nonempty('语言 不能为空'),
			// 日志等级
			level: z
				.enum(LOG_LEVELS, `日志等级 必须为 ${LOG_LEVELS.join(' | ')} 之一`)
				.optional(),
			// 时区 默认 系统时区
			timeZone: z.string('时区 必须为字符串').nonempty('时区 不能为空').optional(),
			// 是否以彩色输出 默认 true
			colorize: z.boolean('时区 必须为布尔值').optional()
		}, 'logger 必须为对象'),
	// 账号
	account: z.object({
				// 账号 token
				token: z.string('token 必须为字符串').nonempty('token 不能为空').optional(),
				// 设备名 默认 <随机字符串>
				device: z.string('设备名 必须为字符串').nonempty('设备名 不能为空').optional(),
				// 平台名 默认 nano-<随机字符串>
				platform: z.string('平台名 必须为字符串').nonempty('平台名 不能为空').optional()
			}, 'account 必须为对象').optional()
});

/**
 * App 配置类型
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;

// Cmd

/**
 * 单选项
 */
export type SelectChoices = { label: string; value: string }[];

// login

/**
 * 登录模式单选项
 */
export const LoginMode: SelectChoices = [
	{ label: '邮箱登录', value: 'email' },
	{ label: '手机登录', value: 'phone' }
] as const;

// 网络

/** 当 HTTP 请求失败超 5 次时 */
export class HttpRequestFailedOn5Error extends Error {
	constructor(public readonly error: string) {
		super(`HTTP 请求失败达 5 次，最后请求失败原因：${error}。`);
		this.name = 'HttpRequestFailedOn5Error';
	}
}

// - 用户信息 -

/**
 * 用户信息（V1 protobuf）
 */
export interface UserInfoV1 {
	status?: Status;
	data?: UserInfo;
}
/**
 * 用户信息（Web json）
 */
export interface UserInfoWeb {
	// 1 为成功
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
	// 1 为成功
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

// 人机验证码

/**
 * 人机验证码
 */
export type Captcha = {
	// 1 为成功
	code: number;
	data: {
		b64s: string;
		id: string;
	};
	msg: string;
}

// 邮箱登录

/**
 * 邮箱登录
 */
export interface EmailLogin {
	// 1 为成功
	code: number;
	data: {
		token: string;
	};
	msg: string;
}

// 手机登录

/**
 * 手机登录
 */
export interface PhoneLogin {
	// 1 为成功
	code: number;
	data: {
		token: string;
	};
	msg: string;
}

// 短信验证码

/**
 * 短信验证码
 */
export interface MsgVerification {
	// 1 为成功
	code: number;
	msg: string;
}
