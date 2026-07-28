import { AppConfig } from "#/types.ts";
import { TTokenTestSuccess } from "#/nano_yunhu/login/token_test.ts";
import { VERSION, APP_NAME } from "#/index.ts";

export class Context {
	private readonly _appConfig: AppConfig;
	private _accountData: TTokenTestSuccess | null = null;

	public readonly appName: string = APP_NAME;
	public readonly appVersion: string = VERSION.join(".");

	public startTimestamp: Date;

	public get appConfig() {
		return this._appConfig;
	}

	/**
	 * @throws Error 不能在未分配时获取
	 */
	public get accountData() {
		if (!this._accountData) {
			throw new Error("No accountData provided.");
		}
		return this._accountData;
	}

	/**
	 * @throws Error 不能被再次修改
	 * @param value
	 */
	public set accountData(value: TTokenTestSuccess) {
		if (this._accountData) {
			throw new Error("Account Data can not be set.");
		}
		this._accountData = value;
	}

	constructor(appConfig: AppConfig) {
		this._appConfig = appConfig;
		this.startTimestamp = new Date();
	}
}
