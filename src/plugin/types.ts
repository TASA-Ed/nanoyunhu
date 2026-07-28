import type { Context } from "#/core/context.ts";
import type { ILogger } from "#/types.ts";

export const HOOK_NAMES = ["preStart", "postStart", "preMessage", "postMessage"] as const;

export type HookName = (typeof HOOK_NAMES)[number];

export interface HookContext {
	/**
	 * APP 上下文
	 */
	ctx: Context;
	/**
	 * 事件
	 */
	event: Record<string, any>;
}

/**
 * hook 函数
 */
export type HookFn = (ctx: HookContext, log: ILogger) => void | Promise<void>;

/**
 * 插件模块的形状
 */
export interface PluginModule {
	/**
	 * 插件名，默认使用文件名
	 */
	name?: string;
	/**
	 * 声明挂载的 hooks
	 */
	hookNameList: HookName[];
	/**
	 * 挂载 hook 的函数
	 */
	[hookName: string]: unknown;
}
