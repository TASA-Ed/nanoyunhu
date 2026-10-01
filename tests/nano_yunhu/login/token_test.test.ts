import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PUser } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel } from "@saltify/typeproto";
import type { ILogger } from "#/types.ts";
import type { HttpResponse } from "#/utils/http.ts";
import { HttpRequestFailedOn5Error } from "#/types.ts";
import { tokenTestV1 } from "#/nano_yunhu/login/token_test.ts";

type SelfInfo = InferProtoModel<typeof PUser.SelfInfo>;
type TokenResponse = HttpResponse<SelfInfo>;
type RandomCase = { random: number; sn: number };
type HttpErrorCase = { label: string; error: unknown; expected: string };
type UnknownNetworkErrorCase = { label: string; error: unknown };

const http = vi.hoisted(() => ({ request: vi.fn<() => Promise<TokenResponse>>() }));
vi.mock("#/utils/http.ts", () => ({ request: http.request }));

function makeLogger(): ILogger {
	return {
		trace: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		child: vi.fn<ILogger["child"]>(),
		level: "info"
	};
}

function userResponse(code: number = 1, msg: string = "ok"): TokenResponse {
	return {
		success: true,
		mimeType: "application/x-protobuf",
		data: {
			status: { requestId: 1n, code, msg },
			data: {
				id: "user-42",
				name: "Test User",
				avatarUrl: "",
				avatarId: 0n,
				phone: "",
				email: "",
				coin: 0,
				isVip: false,
				vipExpiredTimestamp: 0n,
				invitationCode: ""
			}
		}
	};
}

function networkFailure(message: string): TokenResponse {
	return { success: false, kind: "network", error: { name: "Error", message } };
}

beforeEach((): void => {
	http.request.mockReset();
	vi.spyOn(Math, "random").mockReturnValue(0.5);
});

afterEach((): void => {
	http.request.mockReset();
	vi.restoreAllMocks();
});

describe("tokenTestV1", () => {
	it.each<RandomCase>([
		{ random: 0, sn: 100000 },
		{ random: 0.5, sn: 550000 },
		{ random: 1 - Number.EPSILON, sn: 999999 }
	])(
		"returns verified user information and sn $sn for random $random",
		async ({ random, sn }: RandomCase): Promise<void> => {
			vi.mocked(Math.random).mockReturnValue(random);
			http.request.mockResolvedValue(userResponse());

			expect(await tokenTestV1("verified-token", makeLogger())).toEqual({
				success: true,
				userId: "user-42",
				userName: "Test User",
				token: "verified-token",
				sn
			});
			expect(http.request).toHaveBeenCalledTimes(1);
		}
	);

	it("returns the business error without retrying", async (): Promise<void> => {
		http.request.mockResolvedValue(userResponse(2, "Token expired"));

		expect(await tokenTestV1("expired-token", makeLogger())).toEqual({
			success: false,
			error: "Token expired"
		});
		expect(http.request).toHaveBeenCalledTimes(1);
		expect(Math.random).not.toHaveBeenCalled();
	});

	it.each<HttpErrorCase>([
		{ label: "string", error: "HTTP 403", expected: "HTTP 403" },
		{ label: "object", error: { message: "Forbidden" }, expected: "Unknown error" },
		{ label: "null", error: null, expected: "Unknown error" },
		{ label: "number", error: 403, expected: "Unknown error" }
	])("returns the $label HTTP error without retrying", async ({ error, expected }: HttpErrorCase): Promise<void> => {
		http.request.mockResolvedValue({
			success: false,
			kind: "http",
			code: 403,
			error,
			mimeType: "application/json"
		});

		expect(await tokenTestV1("rejected-token", makeLogger())).toEqual({ success: false, error: expected });
		expect(http.request).toHaveBeenCalledTimes(1);
		expect(Math.random).not.toHaveBeenCalled();
	});

	it.each([1, 4])(
		"recovers after %i network failures, including success on the final attempt",
		async (failures: number): Promise<void> => {
			for (let attempt = 0; attempt < failures; attempt++) {
				http.request.mockResolvedValueOnce(networkFailure("Connection lost"));
			}
			http.request.mockResolvedValue(userResponse());

			expect(await tokenTestV1("retry-token", makeLogger())).toEqual({
				success: true,
				userId: "user-42",
				userName: "Test User",
				token: "retry-token",
				sn: 550000
			});
			expect(http.request).toHaveBeenCalledTimes(failures + 1);
		}
	);

	it("throws HttpRequestFailedOn5Error with the last failure after exactly five network failures", async (): Promise<void> => {
		for (let attempt = 1; attempt <= 5; attempt++) {
			http.request.mockResolvedValueOnce(networkFailure(`Connection failed ${attempt}`));
		}
		// A sixth attempt would succeed, so crossing the retry limit cannot accidentally pass.
		http.request.mockResolvedValue(userResponse());

		const result = tokenTestV1("unreachable-token", makeLogger());
		await expect(result).rejects.toBeInstanceOf(HttpRequestFailedOn5Error);
		await expect(result).rejects.toMatchObject({
			name: "HttpRequestFailedOn5Error",
			error: "Connection failed 5"
		});
		expect(http.request).toHaveBeenCalledTimes(5);
		expect(Math.random).not.toHaveBeenCalled();
	});

	it.each<UnknownNetworkErrorCase>([
		{ label: "missing error", error: undefined },
		{ label: "null error", error: null },
		{ label: "missing message", error: { name: "UnknownError" } }
	])(
		"uses the unknown-error fallback for $label after exhausting retries",
		async ({ error }: UnknownNetworkErrorCase): Promise<void> => {
			// Deliberately malformed responses exercise the public defensive fallback.
			const response = { success: false, kind: "network", error } as unknown as TokenResponse;
			http.request.mockResolvedValue(response);

			const result = tokenTestV1("unknown-error-token", makeLogger());
			await expect(result).rejects.toBeInstanceOf(HttpRequestFailedOn5Error);
			await expect(result).rejects.toMatchObject({ error: "Unknown error" });
			expect(http.request).toHaveBeenCalledTimes(5);
			expect(Math.random).not.toHaveBeenCalled();
		}
	);
});
