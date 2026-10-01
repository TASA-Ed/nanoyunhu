import { vi } from "vitest";
import type { Context } from "#/core/context.ts";
import type { AppConfig, ILogger } from "#/types.ts";
import type { HttpResponse } from "#/utils/http.ts";

type ProtocolFixture = Partial<Pick<Context["protocol"], "deleteFriend" | "dismissGroup" | "listMessageByMidSeq">>;

export function makeContext(protocol: ProtocolFixture = {}): Context {
	const appConfig: AppConfig = {
		$version: 3,
		host: "127.0.0.1",
		port: 3000,
		protocol: { type: "satori", accessToken: "access-token" },
		logger: { locale: "zh-CN" },
		network: {
			httpTimeoutMs: 4321,
			websocketHeartbeatIntervalMs: 30000,
			websocketReconnectDelayMs: 5000,
			websocketHeartbeatResponseTimeoutsMs: 1000
		},
		message: { persistence: false }
	};
	const fixture: Pick<Context, "appConfig" | "accountData"> & { protocol: ProtocolFixture } = {
		appConfig,
		accountData: { success: true, userId: "self", userName: "Self", token: "account-token", sn: 1 },
		protocol
	};
	// Only the properties used by protocol utilities are needed; constructing Context starts unrelated services.
	return fixture as unknown as Context;
}

export function makeLogger(): ILogger {
	return {
		trace: vi.fn<ILogger["trace"]>(),
		debug: vi.fn<ILogger["debug"]>(),
		info: vi.fn<ILogger["info"]>(),
		warn: vi.fn<ILogger["warn"]>(),
		error: vi.fn<ILogger["error"]>(),
		child: vi.fn<ILogger["child"]>(),
		level: "info"
	};
}

export function success<T>(data: T): HttpResponse<T> {
	return { success: true, data, mimeType: "application/x-protobuf" };
}

export function binaryBody(body: unknown): Buffer {
	if (!Buffer.isBuffer(body)) throw new TypeError("Expected a Buffer protobuf request body");
	return body;
}

export const transportFailures: { label: string; response: HttpResponse<never> }[] = [
	{
		label: "HTTP error",
		response: { success: false, kind: "http", code: 403, error: "Forbidden", mimeType: "text/plain" }
	},
	{
		label: "network error",
		response: { success: false, kind: "network", error: { name: "TimeoutError", message: "Timed out" } }
	}
];
