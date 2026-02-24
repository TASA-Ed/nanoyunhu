import { writeFile } from "node:fs/promises";
import { resolve } from 'node:path';
import { prompt, select } from '../utils/cmd.js';
import { Logger } from '../utils/logger.js';
import { request } from '../utils/http.js';
import { generateDeviceId } from "../utils/id.ts";
import { tokenTest, TokenTest } from './tokenTest.js';
import { server, startServer } from "./server.ts";
import { saveConfig } from "../config.ts";
import { Captcha, EmailLogin, LoginMode, HttpRequestFailedOn5Error, PhoneLogin, MsgVerification } from '../types.js';

const log = new Logger({prefix: 'Login'});

export class UnknownLoginModeError extends Error {
	constructor(public readonly error: string) {
		super(`未知登录模式：${error}。`);
		this.name = "UnknownLoginModeError";
	}
}

export type InputCaptcha = { id: string; captcha: string; };
export type Verification = { success: true; } | { success: false; error: string; };

export async function login(): Promise<TokenTest> {
	const mode = await select("请选择登录方式", LoginMode);
	return await tryLogin(mode);
}

async function tryLogin(mode: string): Promise<TokenTest> {
	const deviceId: string = (global.appConfig?.account?.device) ? global.appConfig?.account?.device : generateDeviceId();
	log.debug("deviceId:", deviceId);
	const platform: string = (global.appConfig?.account?.platform) ? global.appConfig?.account?.platform : "nano-"+deviceId;
	log.debug("platform:", platform);

	if (!global.appConfig?.account?.device || !global.appConfig?.account?.platform){
		global.appConfig.account.device = deviceId;
		global.appConfig.account.platform = platform;
		try {
			saveConfig(global.appConfig);
			log.debug("已保存配置:", global.appConfig);
		} catch (e){
			log.error("保存配置失败:", e.message);
		}
	}

	if (mode == "email") {
		const email: string = await prompt("输入邮箱");
		const password: string = await prompt("输入密码");

		const body = {
			email,
			password,
			deviceId,
			platform
		};
		let count = 0;

		while (true) {
			const response = await request<EmailLogin>("https://chat-go.jwzhd.com/v1/user/email-login", {
				method: "POST",
				body: JSON.stringify(body)
			}, 8000, log);

			if (response.success && response.data.code === 1) {
				log.debug("Data:", response.data);
				const token = response.data.data.token;

				return await tokenTest(token, log);
			} else {
				let err: string;
				if (response.success) {
					log.error("邮箱登录失败:", response.data.msg);
					log.warn("请重新选择登录方式");
					return login();
				}
				else if (response.isJson) {
					log.error("邮箱登录失败:", response.error.msg);
					log.warn("请重新选择登录方式");
					return login();
				}
				else err = response.error.message;

				count++;

				if (count >= 5) throw new HttpRequestFailedOn5Error(err);
			}
		}
	} else if (mode == "phone") {
		const mobile = await prompt("输入手机号");
		const c = await captcha();
		const v = await verification(mobile, c.captcha, c.id, platform);

		if (v.success){
			const captcha = await prompt("输入验证码");

			const body = {
				mobile,
				captcha,
				deviceId,
				platform
			};
			let count = 0;

			while (true) {
				const response = await request<PhoneLogin>("https://chat-go.jwzhd.com/v1/user/verification-login", {
					method: "POST",
					body: JSON.stringify(body)
				}, 8000, log);
				if (response.success && response.data.code == 1) {
					log.debug("Data:", response.data);
					const token = response.data.data.token;

					return await tokenTest(token, log);
				} else {
					let err: string;
					if (response.success) {
						log.error("手机登录失败:", response.data.msg);
						log.warn("请重新选择登录方式");
						return login();
					}
					else if (response.isJson) {
						log.error("手机登录失败:", response.error.msg);
						log.warn("请重新选择登录方式");
						return login();
					}
					else err = response.error.message;

					count++;

					if (count >= 5) throw new HttpRequestFailedOn5Error(err);
				}
			}
		} else {
			log.error("验证码发送失败:", v.error);
			log.warn("请重新选择登录方式");
			return login();
		}
	} else {
		throw new UnknownLoginModeError(mode);
	}
}

async function captcha(): Promise<InputCaptcha> {
	let count = 0;

	while (true) {
		const response = await request<Captcha>("https://chat-go.jwzhd.com/v1/user/captcha", { method: "POST" }, 8000, log);
		if (response.success && response.data.code == 1) {
			log.debug("Data:", response.data);
			const image = response.data.data.b64s;
			const id = response.data.data.id;

			const png = Buffer.from(image.replace(/^data:image\/\w+;base64,/, ""), 'base64');
			const path = resolve("./captcha.png");
			await writeFile(path, png, 'utf-8');
			server.get('/captcha.png', async (_req, rep) => {
				rep.type('image/png').code(200);
				return png;
			});
			const port = await startServer();
			log.info("获取到 人机验证 图片:", `http://${global.appConfig?.host}:${port}/captcha.png`, path);
			const captcha = await prompt("输入 人机验证 验证码");
			await server.close();

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

async function verification(mobile: string, code: string, id: string, platform: string): Promise<Verification> {
	const body = {
		mobile,
		code,
		id,
		platform
	};
	let count = 0;

	while (true) {
		const response = await request<MsgVerification>("https://chat-go.jwzhd.com/v1/verification/get-verification-code", {
			method: "POST",
			body: JSON.stringify(body)
		}, 8000, log);
		if (response.success && response.data.code == 1) {
			log.debug("Data:", response.data);
			return { success: true };
		} else {
			let err: string;
			if (response.success) return { success: false, error: response.data.msg };
			else if (response.isJson) return { success: false, error: response.error.msg };
			else err = response.error.message;

			count++;

			if (count >= 5) throw new HttpRequestFailedOn5Error(err);
		}
	}
}
