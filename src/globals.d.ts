import type { AppConfig } from "./types.ts";
import type { TTokenTestSuccess } from "./nano_yunhu/login/token_test.ts";

declare global {
	/**
	 * 全局配置
	 */
	var appConfig: AppConfig;
	/**
	 * 登录信息
	 */
	var accountData: TTokenTestSuccess;
}

export {};
