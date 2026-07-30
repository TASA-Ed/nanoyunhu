import { AppConfig } from "#/types.ts";
import { TTokenTestSuccess } from "#/nano_yunhu/login/token_test.ts";
import { VERSION, APP_NAME } from "#/index.ts";
import { HookManager } from "#/plugin/manager.ts";
import { ProtocolService } from "#/nano_yunhu/protocols/utils/protocol_service.ts";
import { UtilsService } from "#/utils/utils_service.ts";

export class Context {
	private readonly _appConfig: AppConfig;
	private _accountData: TTokenTestSuccess | null = null;
	private _pluginManager: HookManager | null = null;

	public readonly appName: string = APP_NAME;
	public readonly appVersion: string = VERSION.join(".");

	public startTimestamp: Date;
	public protocol: ProtocolService;
	public utils: UtilsService;

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

	/**
	 * @throws Error 不能在未分配时获取
	 */
	public get pluginManager(): HookManager {
		if (!this._pluginManager) {
			throw new Error("No accountData provided.");
		}
		return this._pluginManager;
	}

	/**
	 * @throws Error 不能被再次修改
	 * @param value
	 */
	public set pluginManager(value: HookManager) {
		if (this._pluginManager) {
			throw new Error("Account Data can not be set.");
		}
		this._pluginManager = value;
	}

	constructor(appConfig: AppConfig) {
		this._appConfig = appConfig;
		this.startTimestamp = new Date();
		this.protocol = new ProtocolService(this);
		this.utils = new UtilsService(this);
	}
}
