import { LogLevel, Colors, LoggerOptions, InitOptions } from '../types.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

const LEVEL_COLORS: Record<LogLevel, string> = {
	debug: Colors.gray,
	info: Colors.boldCyan,
	warn: Colors.boldYellow,
	error: Colors.boldRed,
};

const LEVEL_LABELS: Record<LogLevel, string> = {
	debug: 'DEBUG',
	info: 'INFO',
	warn: 'WARN',
	error: 'ERROR',
};

let _initialized = false;
let _locale: string | undefined;
let _timeZone: string = new Intl.DateTimeFormat().resolvedOptions().timeZone;
let _globalLevel: LogLevel | undefined;
let _globalColorize: boolean | undefined;

/**
 * 初始化全局 Logger 配置。应在 appConfig 加载完成后尽早调用一次。
 * 调用后所有已存在及未来创建的 Logger 实例都将使用高级输出模式。
 *
 * @example
 * // 在入口文件加载配置后：
 * initLogger(global.appConfig.logger);
 */
export function initLogger(options: InitOptions = { locale: "zh-CN" }): void {
	if (_initialized) {
		// 允许重复调用以更新配置（例如热重载场景），但输出一次警告
		console.warn('[Logger] initLogger() called more than once, updating config.');
	}

	_locale = options.locale;
	_timeZone = options.timeZone ?? new Intl.DateTimeFormat().resolvedOptions().timeZone;
	_globalLevel = options.level;
	_globalColorize = options.colorize;
	_initialized = true;
}

/** 是否已初始化（可用于外部检测） */
export function isLoggerInitialized(): boolean {
	return _initialized;
}

export class Logger {
	private level: LogLevel;
	private readonly prefix: string;
	private readonly colorize: boolean;
	private readonly maxDepth: number;
	private readonly timestamp: boolean;

	constructor(options: LoggerOptions = {}) {
		this.level = options.level ?? 'info';
		this.prefix = options.prefix ?? '';
		this.colorize = options.colorize ?? true;
		this.maxDepth = options.maxDepth ?? 10;
		this.timestamp = options.timestamp ?? true;
	}

	debug(...args: unknown[]): void {
		this.log('debug', ...args);
	}

	info(...args: unknown[]): void {
		this.log('info', ...args);
	}

	warn(...args: unknown[]): void {
		this.log('warn', ...args);
	}

	error(...args: unknown[]): void {
		this.log('error', ...args);
	}

	/** 创建一个带子前缀的子 Logger */
	child(prefix: string): Logger {
		return new Logger({
			level: this.level,
			prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
			colorize: this.colorize,
			maxDepth: this.maxDepth,
			timestamp: this.timestamp,
		});
	}

	/** 动态设置最低日志级别 */
	setLevel(level: LogLevel): void {
		this.level = level;
	}

	private log(level: LogLevel, ...args: unknown[]): void {
		// 全局级别覆盖（初始化后生效）
		const effectiveLevel = (_initialized && _globalLevel) ? _globalLevel : this.level;
		if (LEVEL_ORDER[level] < LEVEL_ORDER[effectiveLevel]) return;

		if (!_initialized) {
			const consoleMethod: Record<LogLevel, (...a: unknown[]) => void> = {
				debug: console.debug,
				info:  console.info,
				warn:  console.warn,
				error: console.error,
			};
			const tag = this.prefix ? `[${this.prefix}]` : '';
			consoleMethod[level](`[${level.toUpperCase()}]${tag}`, ...args);
			return;
		}

		const effectiveColorize = _globalColorize ?? this.colorize;
		const parts: string[] = [];

		// 时间戳
		if (this.timestamp) {
			const ts = new Date().toLocaleString(_locale, {
				timeZone: _timeZone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
			});
			parts.push(effectiveColorize ? `${Colors.dim}${ts}${Colors.reset}` : ts);
		}

		// 级别标签
		const label = LEVEL_LABELS[level];
		parts.push(
			effectiveColorize
				? `${LEVEL_COLORS[level]}${label}${Colors.reset}`
				: label
		);

		// 前缀
		if (this.prefix) {
			parts.push(
				effectiveColorize
					? `${Colors.magenta}[${this.prefix}]${Colors.reset}`
					: `[${this.prefix}]`
			);
		}

		// 序列化每个参数
		const serialized = args
			.map((arg) => this.serialize(arg, 0, new Set(), effectiveColorize))
			.join(' ');

		parts.push(serialized);

		const output = parts.join(' ');

		if (level === 'error') {
			process.stderr.write(output + '\n');
		} else {
			process.stdout.write(output + '\n');
		}
	}

	private serialize(
		value: unknown,
		depth: number,
		seen: Set<object>,
		colorize: boolean,
	): string {
		// null
		if (value === null) {
			return colorize ? `${Colors.gray}null${Colors.reset}` : 'null';
		}

		// undefined
		if (value === undefined) {
			return colorize ? `${Colors.gray}undefined${Colors.reset}` : 'undefined';
		}

		// boolean
		if (typeof value === 'boolean') {
			const s = String(value);
			return colorize ? `${Colors.yellow}${s}${Colors.reset}` : s;
		}

		// number / bigint
		if (typeof value === 'number' || typeof value === 'bigint') {
			const s = typeof value === 'bigint' ? `${value}n` : String(value);
			return colorize ? `${Colors.green}${s}${Colors.reset}` : s;
		}

		// symbol
		if (typeof value === 'symbol') {
			const s = value.toString();
			return colorize ? `${Colors.cyan}${s}${Colors.reset}` : s;
		}

		// string
		if (typeof value === 'string') {
			const s = (depth == 0) ? value : `"${value}"`;
			return colorize ? `${Colors.white}${s}${Colors.reset}` : s;
		}

		// function
		if (typeof value === 'function') {
			const s = `[Function: ${value.name || 'anonymous'}]`;
			return colorize ? `${Colors.cyan}${s}${Colors.reset}` : s;
		}

		// 对象类型（Array / Map / Set / Date / Error / RegExp / 普通对象）
		if (typeof value === 'object') {
			// 循环引用检测
			if (seen.has(value as object)) {
				const s = '[Circular]';
				return colorize ? `${Colors.red}${s}${Colors.reset}` : s;
			}

			// 超过最大深度
			if (depth >= this.maxDepth) {
				const s = '[MaxDepth]';
				return colorize ? `${Colors.gray}${s}${Colors.reset}` : s;
			}

			const childSeen = new Set(seen);
			childSeen.add(value as object);

			if (value instanceof Error)  return this.serializeError(value, depth, childSeen, colorize);
			if (value instanceof Date)   { const s = `Date(${value.toISOString()})`; return colorize ? `${Colors.green}${s}${Colors.reset}` : s; }
			if (value instanceof RegExp) { const s = value.toString(); return colorize ? `${Colors.cyan}${s}${Colors.reset}` : s; }
			if (value instanceof Map)    return this.serializeMap(value, depth, childSeen, colorize);
			if (value instanceof Set)    return this.serializeSet(value, depth, childSeen, colorize);
			if (Array.isArray(value))    return this.serializeArray(value, depth, childSeen, colorize);

			// Buffer / Uint8Array
			if (Buffer.isBuffer(value)) {
				const s = `Buffer(${value.length})`;
				return colorize ? `${Colors.gray}${s}${Colors.reset}` : s;
			}

			// 普通对象 / class 实例
			return this.serializeObject(value as Record<string, unknown>, depth, childSeen, colorize);
		}

		return String(value);
	}

	private serializeArray(arr: unknown[], depth: number, seen: Set<object>, colorize: boolean): string {
		if (arr.length === 0) return '[]';
		const indent = '  '.repeat(depth + 1);
		const closingIndent = '  '.repeat(depth);
		const items = arr.map((item) => `${indent}${this.serialize(item, depth + 1, seen, colorize)}`);
		return `[\n${items.join(',\n')}\n${closingIndent}]`;
	}

	private serializeObject(obj: Record<string, unknown>, depth: number, seen: Set<object>, colorize: boolean): string {
		const keys = [
			...Object.getOwnPropertyNames(obj),
			...Object.getOwnPropertySymbols(obj),
		];

		if (keys.length === 0) return '{}';

		const indent = '  '.repeat(depth + 1);
		const closingIndent = '  '.repeat(depth);
		const className = obj.constructor?.name && obj.constructor.name !== 'Object'
			? `${obj.constructor.name} `
			: '';

		const entries = keys.map((key) => {
			const keyStr = typeof key === 'symbol' ? key.toString() : key;
			const coloredKey = colorize
				? `${Colors.blue}"${keyStr}"${Colors.reset}`
				: `"${keyStr}"`;
			const val = this.serialize((obj as Record<string | symbol, unknown>)[key], depth + 1, seen, colorize);
			return `${indent}${coloredKey}: ${val}`;
		});

		return `${className}{\n${entries.join(',\n')}\n${closingIndent}}`;
	}

	private serializeMap(map: Map<unknown, unknown>, depth: number, seen: Set<object>, colorize: boolean): string {
		if (map.size === 0) return 'Map(0) {}';
		const indent = '  '.repeat(depth + 1);
		const closingIndent = '  '.repeat(depth);
		const entries: string[] = [];
		for (const [k, v] of map) {
			entries.push(`${indent}${this.serialize(k, depth + 1, seen, colorize)} => ${this.serialize(v, depth + 1, seen, colorize)}`);
		}
		return `Map(${map.size}) {\n${entries.join(',\n')}\n${closingIndent}}`;
	}

	private serializeSet(set: Set<unknown>, depth: number, seen: Set<object>, colorize: boolean): string {
		if (set.size === 0) return 'Set(0) {}';
		const indent = '  '.repeat(depth + 1);
		const closingIndent = '  '.repeat(depth);
		const entries = [...set].map((item) => `${indent}${this.serialize(item, depth + 1, seen, colorize)}`);
		return `Set(${set.size}) {\n${entries.join(',\n')}\n${closingIndent}}`;
	}

	private serializeError(err: Error, depth: number, seen: Set<object>, colorize: boolean): string {
		const indent = '  '.repeat(depth + 1);
		const closingIndent = '  '.repeat(depth);
		const name    = colorize ? `${Colors.red}${err.name}${Colors.reset}` : err.name;
		const message = colorize ? `${Colors.white}"${err.message}"${Colors.reset}` : `"${err.message}"`;

		const lines = [
			`${indent}name: ${name}`,
			`${indent}message: ${message}`,
		];

		if (err.stack) {
			const stack = err.stack
				.split('\n')
				.slice(1)
				.map((l) => l.trim())
				.join('\n' + indent + '  ');
			const stackStr = colorize ? `${Colors.gray}${stack}${Colors.reset}` : stack;
			lines.push(`${indent}stack:\n${indent}  ${stackStr}`);
		}

		// 附加属性（如 cause、code 等）
		const extra = Object.getOwnPropertyNames(err).filter(
			(k) => !['name', 'message', 'stack'].includes(k)
		);
		for (const key of extra) {
			const coloredKey = colorize ? `${Colors.blue}"${key}"${Colors.reset}` : `"${key}"`;
			const val = this.serialize((err as unknown as Record<string, unknown>)[key], depth + 1, seen, colorize);
			lines.push(`${indent}${coloredKey}: ${val}`);
		}

		return `${err.constructor.name} {\n${lines.join(',\n')}\n${closingIndent}}`;
	}
}

/**
 * 默认 命名空间 （App）
 */
export default new Logger({ prefix: 'App' });
