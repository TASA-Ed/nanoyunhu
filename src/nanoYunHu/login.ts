import { writeFile } from "node:fs/promises";
import { resolve } from 'node:path';
import { Logger } from '../utils/logger.ts';
import { exitClear } from "./main.ts";
import { request } from '../utils/http.ts';
import { getIdAndPlatform } from "../utils/device.ts";
import { tokenTest, TokenTest } from './tokenTest.ts';
import { closeAndRestartServer, server, startServer } from "../utils/server.ts";
import { Captcha, EmailLogin, HttpRequestFailedOn5Error, MsgVerification, PhoneLogin } from '../types.ts';
import { select, password as inputPassword, input} from '@inquirer/i18n';

const log = new Logger({ prefix: 'Login' });

export class UnknownLoginModeError extends Error {
	constructor(public readonly error: string) {
		super(`未知登录模式：${error}。`);
		this.name = "UnknownLoginModeError";
	}
}

export type InputCaptcha = { id: string; captcha: string; };
export type Verification = { success: true; } | { success: false; error: string; };

/**
 * 登录函数
 * @description 此函数需要用户操作，返回的 TokenTest 可能是失败的。
 * @returns TokenTest
 */
export async function login(): Promise<TokenTest> {
	try {
		while (true) {
			const mode = await select({
				message: "请选择登录方式",
				choices: [
					{
						name: '邮箱登录',
						value: 'email',
						description: '使用邮箱登录，需要账号绑定邮箱'
					},
					{
						name: '手机登录',
						value: 'phone',
						description: '使用手机登录，访问本地服务器或本地文件查看人机验证码'
					},
					{
						name: 'Token 登录',
						value: 'token',
						description: '使用 Token 登录，请填写一个可用的 Token'
					}
				]
			});

			const result = await tryLogin(mode);
			if (result) return result;
		}
	} catch (e) {
		if (e instanceof Error && e.name === 'ExitPromptError') {
			await exitClear();
			process.exit(130);
		} else {
			throw e;
		}
	}
}

async function tryLogin(mode: string): Promise<TokenTest | null> {
	if (!global.appConfig) {
		throw new Error("appConfig is not initialized");
	}

	const idAndPlatform = getIdAndPlatform(log);

	switch (mode) {
		case "email":
			const email: string = await input({ message: "输入邮箱" });
			const password: string = await inputPassword({ message: "输入密码", mask: true });

			const body = {
				email,
				password,
				deviceId: idAndPlatform.deviceId,
				platform: idAndPlatform.platform
			};
			const result = await requestTokenWithRetry<EmailLogin>(
				"https://chat-go.jwzhd.com/v1/user/email-login",
				body,
				"邮箱"
			);
			if (!result) log.warn("请重新选择登录方式");
			return result;
		case "phone":
			const mobile = await input({ message: "输入手机号" });
			const captcha = await getCaptcha();
			const verification = await getVerification(mobile, captcha.captcha, captcha.id, idAndPlatform.platform);

			if (verification.success) {
				const captcha = await input({ message: "输入验证码" });

				const body = {
					mobile,
					captcha,
					deviceId: idAndPlatform.deviceId,
					platform: idAndPlatform.platform
				};
				const result = await requestTokenWithRetry<PhoneLogin>(
					"https://chat-go.jwzhd.com/v1/user/verification-login",
					body,
					"手机"
				);
				if (!result) log.warn("请重新选择登录方式");
				return result;
			} else {
				log.error("验证码发送失败:", verification.error);
				log.warn("请重新选择登录方式");
				return null;
			}
		case "token":
			const token = await inputPassword({ message: "输入账号 Token", mask: true });
			log.warn("登录失败，Token 不能为空，请重新选择登录方式");
			if (!token) return null;
			const test = await tokenTest(token, log);
			if (!test.success) {
				log.error(`登录失败:`, (test.error == "未登录") ? "Token 无效" : test.error);
				log.warn("请重新选择登录方式");
				return null;
			}
			return test;
		default:
			throw new UnknownLoginModeError(mode);
	}
}

async function requestTokenWithRetry<T extends { code: number; data: { token: string }; msg: string }>(
	url: string,
	body: Record<string, string>,
	label: string
): Promise<TokenTest | null> {
	let count = 0;

	while (true) {
		const response = await request<T>(url, {
			method: "POST",
			body: JSON.stringify(body)
		}, global.appConfig.network.httpTimeoutMs, log);

		if (response.success && response.data.code === 1) {
			log.debug("Data:", response.data);
			const token = response.data.data.token;

			return await tokenTest(token, log);
		} else {
			let err: string;
			if (response.success) {
				log.debug('Failed:', response.data);
				log.error(`${label}登录失败:`, response.data.msg);
				return null;
			} else if (response.isJson) {
				log.debug('Failed:', response.error);
				log.error(`${label}登录失败:`, response.error.msg);
				return null;
			} else err = response.error.message;

			count++;

			if (count >= 5) throw new HttpRequestFailedOn5Error(err);
		}
	}
}

async function getCaptcha(): Promise<InputCaptcha> {
	let count = 0;

	while (true) {
		const response = await request<Captcha>("https://chat-go.jwzhd.com/v1/user/captcha", { method: "POST" }, global.appConfig.network.httpTimeoutMs, log);
		if (response.success && response.data.code == 1) {
			log.debug("Data:", response.data);
			const image = response.data.data.b64s;
			const id = response.data.data.id;

			const png = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
			const path = resolve("./captcha.png");
			await writeFile(path, png);
			// 关闭服务器时会重新创建一个，因此不会重复注册路由。
			server.get('/captcha.png', async (_req, rep) => {
				rep.type('image/png').code(200);
				return png;
			});
			// 如果随机端口的服务器都开不了了就没法继续运行了，所以不用捕获异常。
			const port = await startServer();
			log.info("获取到 人机验证 图片:", `http://${global.appConfig?.host}:${port}/captcha.png`, path);
			const captcha = await input({ message: "输入 人机验证 验证码" });
			await closeAndRestartServer();

			return { id, captcha };
		} else {
			let err: string;
			if (response.success) {
				log.debug('Failed:', response.data);
				err = response.data.msg;
			}
			else if (response.isJson) {
				log.debug('Failed:', response.error);
				err = response.error.msg;
			}
			else err = response.error.message;

			count++;

			if (count >= 5) throw new HttpRequestFailedOn5Error(err);
		}
	}
}

async function getVerification(mobile: string, code: string, id: string, platform: string): Promise<Verification> {
	const body = {
		mobile,
		code,
		id,
		platform
	};

	const response = await request<MsgVerification>("https://chat-go.jwzhd.com/v1/verification/get-verification-code", {
		method: "POST",
		body: JSON.stringify(body)
	}, global.appConfig.network.httpTimeoutMs, log);
	if (response.success && response.data.code == 1) {
		log.debug("Data:", response.data);
		return { success: true };
	} else {
		if (response.success) {
			log.debug('Failed:', response.data);
			return {success: false, error: response.data.msg};
		}
		if (response.isJson) {
			log.debug('Failed:', response.error);
			return {success: false, error: response.error.msg};
		}

		throw new HttpRequestFailedOn5Error(response.error.message);
	}
}
