/**
 * 人机验证码
 */
export type TCaptcha = {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly b64s: string;
		readonly id: string;
	};
	readonly msg: string;
};

/**
 * 邮箱登录
 */
export type TEmailLogin = {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly token: string;
	};
	readonly msg: string;
};

/**
 * 手机登录
 */
export type TPhoneLogin = {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly token: string;
	};
	readonly msg: string;
};

/**
 * 短信验证码
 */
export type TMsgVerification = {
	// 1 为成功
	readonly code: number;
	readonly msg: string;
};
