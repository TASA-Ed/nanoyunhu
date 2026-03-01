import { writeFile } from "node:fs/promises";
import { resolve } from 'node:path';
import { prompt, select } from '../utils/cmd.ts';
import { Logger } from '../utils/logger.ts';
import { request } from '../utils/http.ts';
import { getIdAndPlatform} from "../utils/device.ts";
import { tokenTest, TokenTest } from './tokenTest.ts';
import { server, startServer, closeAndRestartServer } from "../utils/server.ts";
import { Captcha, EmailLogin, LoginMode, HttpRequestFailedOn5Error, PhoneLogin, MsgVerification } from '../types.ts';

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
 * 登录
 * @returns TokenTest
 */
export async function login(): Promise<TokenTest> {
	while (true) {
		const mode = await select("请选择登录方式", LoginMode);
		const result = await tryLogin(mode);
		if (result) return result;
	}
}

async function tryLogin(mode: string): Promise<TokenTest | null> {
	if (!global.appConfig) {
		throw new Error("appConfig is not initialized");
	}

	const idAndPlatform = getIdAndPlatform(log);

	if (mode == "email") {
		const email: string = await prompt("输入邮箱");
		const password: string = await prompt("输入密码");

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
	} else if (mode == "phone") {
		const mobile = await prompt("输入手机号");
		const captcha = await getCaptcha();
		const verification = await getVerification(mobile, captcha.captcha, captcha.id, idAndPlatform.platform);

		if (verification.success) {
			const captcha = await prompt("输入验证码");

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
	} else {
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
				log.error(`${label}登录失败:`, response.data.msg);
				return null;
			} else if (response.isJson) {
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
			const captcha = await prompt("输入 人机验证 验证码");
			await closeAndRestartServer();

			return { id, captcha };
		} else {
			let err: string;
			if (response.success) err = response.data.msg;
			else if (response.isJson) err = response.error.msg;
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
		if (response.success) return { success: false, error: response.data.msg };
		if (response.isJson) return { success: false, error: response.error.msg };

		throw new HttpRequestFailedOn5Error(response.error.message);
	}
}
