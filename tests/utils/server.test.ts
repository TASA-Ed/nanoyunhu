import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createServer as createTcpServer } from "node:net";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "#/core/context.ts";
import { closeAndRestartServer, closeServer, server, startServer } from "#/utils/server.ts";

vi.mock("#/utils/logger.ts", () => ({
	Logger: class {
		trace() {}
		debug() {}
		info() {}
		warn() {}
		error() {}
	}
}));

const ctx = { appConfig: { host: "127.0.0.1" } } as unknown as Context;

function get(port: number, path = "/health"): Promise<{ status: number | undefined; body: unknown }> {
	const { promise, resolve, reject } = Promise.withResolvers<{ status: number | undefined; body: unknown }>();
	const request = httpRequest({ host: "127.0.0.1", port, path, agent: false }, (response) => {
		let body = "";
		response.setEncoding("utf8");
		response.on("data", (chunk: string) => {
			body += chunk;
		});
		response.on("error", reject);
		response.on("end", () => {
			try {
				resolve({ status: response.statusCode, body: JSON.parse(body) });
			} catch (error) {
				reject(error);
			}
		});
	});
	request.on("error", reject);
	request.end();
	return promise;
}

beforeEach(async () => {
	await closeAndRestartServer();
});

afterEach(async () => {
	// Restore failed-close simulations before releasing the real listener.
	vi.restoreAllMocks();
	await closeAndRestartServer();
});

describe("server startup and shutdown", () => {
	it("starts on an ephemeral localhost port and serves registered routes", async () => {
		server.get("/health", () => ({ healthy: true }));
		const port = await startServer(ctx);
		expect(port).toBeGreaterThan(0);
		expect(port).toBeLessThanOrEqual(65535);
		expect(server.server.address()).toMatchObject({ address: "127.0.0.1", port });
		expect(await get(port!)).toEqual({ status: 200, body: { healthy: true } });
	});

	it("returns the existing listener on repeated startup without replacing registered routes", async () => {
		server.get("/health", () => ({ generation: "original" }));
		const instance = server;
		const port = await startServer(ctx);
		expect(await startServer(ctx, 0)).toBe(port);
		expect(await startServer(ctx, port!)).toBe(port);
		expect(server).toBe(instance);
		expect(await get(port!)).toEqual({ status: 200, body: { generation: "original" } });
	});

	it("closes the real listener idempotently without replacing the singleton", async () => {
		server.get("/health", () => ({ healthy: true }));
		const instance = server;
		const port = await startServer(ctx);
		expect(await get(port!)).toEqual({ status: 200, body: { healthy: true } });
		await closeServer();
		await closeServer();
		expect(server).toBe(instance);
		expect(server.server.listening).toBe(false);
		expect(server.server.address()).toBeNull();
		await expect(get(port!)).rejects.toMatchObject({ code: "ECONNREFUSED" });
	});

	it("can close an idle singleton and subsequently start it", async () => {
		const instance = server;
		await closeServer();
		expect(server).toBe(instance);
		server.get("/health", () => ({ healthy: true }));
		const port = await startServer(ctx);
		expect(await get(port!)).toEqual({ status: 200, body: { healthy: true } });
	});
});

describe("server recreation", () => {
	it("closes the previous listener and starts a fresh route registry", async () => {
		server.get("/previous", () => ({ generation: "previous" }));
		const previous = server;
		const oldPort = await startServer(ctx);
		expect(await get(oldPort!, "/previous")).toEqual({ status: 200, body: { generation: "previous" } });
		await closeAndRestartServer();
		expect(server).not.toBe(previous);
		expect(previous.server.listening).toBe(false);
		expect(server.server.listening).toBe(false);
		await expect(get(oldPort!, "/previous")).rejects.toMatchObject({ code: "ECONNREFUSED" });

		server.get("/health", () => ({ generation: "current" }));
		const port = await startServer(ctx);
		expect(await get(port!)).toEqual({ status: 200, body: { generation: "current" } });
		expect((await get(port!, "/previous")).status).toBe(404);
	});

	it("replaces an idle singleton and discards its unstarted routes", async () => {
		server.get("/previous", () => ({ generation: "previous" }));
		const previous = server;
		await closeAndRestartServer();
		expect(server).not.toBe(previous);
		server.get("/health", () => ({ generation: "current" }));
		const port = await startServer(ctx);
		expect(await get(port!)).toEqual({ status: 200, body: { generation: "current" } });
		expect((await get(port!, "/previous")).status).toBe(404);
	});
});

describe("server errors", () => {
	it("rejects an occupied port without taking over or closing its existing listener", async () => {
		const occupied = createTcpServer((socket) => socket.end());
		const listening = once(occupied, "listening");
		occupied.listen(0, "127.0.0.1");
		await listening;
		try {
			const port = (occupied.address() as AddressInfo).port;
			await expect(startServer(ctx, port)).rejects.toMatchObject({ code: "EADDRINUSE" });
			expect(server.server.listening).toBe(false);
			expect(occupied.listening).toBe(true);
			await closeAndRestartServer();
			server.get("/health", () => ({ recovered: true }));
			const recoveredPort = await startServer(ctx);
			expect(await get(recoveredPort!)).toEqual({ status: 200, body: { recovered: true } });
		} finally {
			const { promise, resolve, reject } = Promise.withResolvers<void>();
			occupied.close((error) => (error ? reject(error) : resolve()));
			await promise;
		}
	});

	it.each([-1, 65536])("rejects an out-of-range port %s without opening a listener", async (port) => {
		await expect(startServer(ctx, port)).rejects.toMatchObject({ code: "ERR_SOCKET_BAD_PORT" });
		expect(server.server.listening).toBe(false);
		expect(server.server.address()).toBeNull();
	});

	it("leaves a serving instance intact when ordinary shutdown fails", async () => {
		server.get("/health", () => ({ healthy: true }));
		const instance = server;
		const port = await startServer(ctx);
		vi.spyOn(server, "close").mockRejectedValueOnce(new Error("simulated close failure"));
		await closeServer();
		expect(server).toBe(instance);
		expect(server.server.listening).toBe(true);
		expect(await get(port!)).toEqual({ status: 200, body: { healthy: true } });
		await closeServer();
		expect(server.server.listening).toBe(false);
	});

	it("rejects a failed recreation rather than replacing a still-serving instance", async () => {
		server.get("/health", () => ({ generation: "original" }));
		const instance = server;
		const port = await startServer(ctx);
		vi.spyOn(server, "close").mockRejectedValueOnce(new Error("simulated close failure"));
		await expect(closeAndRestartServer()).rejects.toBeInstanceOf(Error);
		expect(server).toBe(instance);
		expect(server.server.listening).toBe(true);
		expect(await get(port!)).toEqual({ status: 200, body: { generation: "original" } });
		await closeAndRestartServer();
		expect(server).not.toBe(instance);
		expect(instance.server.listening).toBe(false);
	});
});
