import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ILogger } from "#/types.ts";
import { request } from "#/utils/http.ts";

const transport = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("undici", () => ({
	request: transport.request,
	// Import-time proxy discovery must not create a real dispatcher from the host environment.
	ProxyAgent: class {}
}));

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

function respond(status: number, contentType: string | string[] | undefined, content: string | Uint8Array): void {
	const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
	transport.request.mockResolvedValue({
		statusCode: status,
		headers: { "content-type": contentType },
		body: {
			text: async () => new TextDecoder().decode(bytes),
			arrayBuffer: async () => Uint8Array.from(bytes).buffer
		}
	});
}

beforeEach(() => {
	transport.request.mockReset();
	// Exercise response handling without leaving native timeout signals alive after a test.
	vi.spyOn(AbortSignal, "timeout").mockImplementation(() => new AbortController().signal);
});

afterEach(() => {
	vi.restoreAllMocks();
});

const url = "https://example.invalid/response";

describe("HTTP response parsing", () => {
	it("normalizes array content-type headers and parses JSON with charset parameters", async () => {
		respond(200, ["  Application/JSON; Charset=UTF-8  ", "text/plain"], '{"answer":42}');
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: true,
			data: { answer: 42 },
			mimeType: "application/json; charset=utf-8"
		});
	});

	it("recognizes JSON-LD responses", async () => {
		respond(200, "application/ld+json", '{"@id":"example"}');
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: true,
			data: { "@id": "example" },
			mimeType: "application/ld+json"
		});
	});

	it("returns malformed JSON as text instead of a network error", async () => {
		respond(200, "application/json", "{invalid json");
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: true,
			data: "{invalid json",
			mimeType: "application/json"
		});
	});

	it("keeps text responses as text even when their contents resemble JSON", async () => {
		respond(200, "text/plain", '{"answer":42}');
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: true,
			data: '{"answer":42}',
			mimeType: "text/plain"
		});
	});

	it("uses octet-stream for missing content-type and preserves arbitrary binary bytes", async () => {
		const bytes = Uint8Array.of(0, 255, 128, 42);
		respond(200, undefined, bytes);
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: true,
			data: bytes.buffer,
			mimeType: "application/octet-stream"
		});
	});

	it.each([
		{ status: 199, success: false },
		{ status: 200, success: true },
		{ status: 299, success: true },
		{ status: 300, success: false }
	])("classifies status $status at the 2xx boundaries", async ({ status, success }) => {
		respond(status, "text/plain", "response");
		const result = await request(url, {}, makeLogger(), 8000);
		expect(result).toEqual(
			success
				? { success: true, data: "response", mimeType: "text/plain" }
				: { success: false, kind: "http", code: status, error: "response", mimeType: "text/plain" }
		);
	});
});

describe("HTTP errors", () => {
	it("preserves structured API errors", async () => {
		respond(403, "application/json", '{"code":"forbidden","details":["permission"]}');
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: false,
			kind: "http",
			code: 403,
			error: { code: "forbidden", details: ["permission"] },
			mimeType: "application/json"
		});
	});

	it.each(["text/plain", "application/json"])(
		"provides a status fallback for an empty %s error body",
		async (mimeType) => {
			respond(503, mimeType, "");
			expect(await request(url, {}, makeLogger(), 8000)).toEqual({
				success: false,
				kind: "http",
				code: 503,
				error: "HTTP 503",
				mimeType
			});
		}
	);

	it.each(["null", "false", "0"])(
		"does not replace the structured JSON error value %s with a status fallback",
		async (body) => {
			respond(400, "application/json", body);
			expect(await request(url, {}, makeLogger(), 8000)).toEqual({
				success: false,
				kind: "http",
				code: 400,
				error: JSON.parse(body),
				mimeType: "application/json"
			});
		}
	);

	it("preserves an ordinary network error's name and message", async () => {
		transport.request.mockRejectedValue(new TypeError("connection failed"));
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: false,
			kind: "network",
			error: { name: "TypeError", message: "connection failed" }
		});
	});

	it.each(["TimeoutError", "AbortError"])("reports the configured timeout for %s", async (name) => {
		transport.request.mockRejectedValue(new DOMException("upstream message", name));
		expect(await request(url, {}, makeLogger(), 1234)).toEqual({
			success: false,
			kind: "network",
			error: { name, message: expect.stringContaining("1234ms") }
		});
	});

	it("normalizes a non-Error rejection", async () => {
		transport.request.mockRejectedValue(null);
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: false,
			kind: "network",
			error: { name: "UnknownError", message: "unknown message" }
		});
	});

	it("classifies body-reading failures as network errors", async () => {
		transport.request.mockResolvedValue({
			statusCode: 200,
			headers: { "content-type": "text/plain" },
			body: {
				text: async () => {
					throw new Error("body disconnected");
				}
			}
		});
		expect(await request(url, {}, makeLogger(), 8000)).toEqual({
			success: false,
			kind: "network",
			error: { name: "Error", message: "body disconnected" }
		});
	});
});
