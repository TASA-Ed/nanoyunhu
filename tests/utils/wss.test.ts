import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PWss } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { Context } from "#/core/context.ts";
import type { IWssClient } from "#/utils/wss.ts";
import { WssClient } from "#/utils/wss.ts";

const transport = vi.hoisted(() => {
	class Socket {
		static readonly OPEN = 1;
		static readonly CONNECTING = 0;
		readyState: number = Socket.CONNECTING;
		readonly sent: string[] = [];
		closeCalls = 0;
		terminateCalls = 0;
		private readonly listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

		constructor(readonly url: string) {
			sockets.push(this);
		}

		on(event: string, listener: (...args: unknown[]) => void): this {
			(this.listeners[event] ??= []).push(listener);
			return this;
		}

		private emit(event: string, ...args: unknown[]): void {
			for (const listener of this.listeners[event] ?? []) listener(...args);
		}

		open(): void {
			this.readyState = Socket.OPEN;
			this.emit("open");
		}

		send(data: string): void {
			if (this.readyState !== Socket.OPEN) throw new Error("Socket is not open");
			this.sent.push(data);
		}

		receive(data: Buffer | string): void {
			this.emit("message", data);
		}

		fail(error: Error): void {
			this.emit("error", error);
		}

		disconnect(code = 1006, reason = Buffer.alloc(0)): void {
			if (this.readyState === 3) return;
			this.readyState = 3;
			this.emit("close", code, reason);
		}

		terminate(): void {
			this.terminateCalls++;
			this.disconnect();
		}

		close(): void {
			this.closeCalls++;
			this.disconnect(1000);
		}
	}

	const sockets: Socket[] = [];
	return { WebSocket: Socket, sockets };
});

vi.mock("ws", () => ({ default: transport.WebSocket }));
vi.mock("#/utils/logger.ts", () => ({
	Logger: class {
		level = "info";
		trace() {}
		debug() {}
		info() {}
		warn() {}
		error() {}
	}
}));

const clients: WssClient[] = [];

function makeClient(overrides: Partial<IWssClient> = {}) {
	let sequence = 0;
	const ctx = {
		appConfig: {
			network: {
				websocketHeartbeatIntervalMs: 100,
				websocketReconnectDelayMs: 20,
				websocketHeartbeatResponseTimeoutsMs: 35
			}
		},
		utils: { generateWssSeq: () => `seq-${++sequence}` }
	} as unknown as Context;
	const onMessage = vi.fn();
	const onOpen = vi.fn();
	const onClose = vi.fn();
	const onError = vi.fn();
	const client = new WssClient(ctx, {
		url: "ws://example.invalid/socket",
		userId: "user-1",
		token: "access-token",
		platform: "test-platform",
		deviceId: "device-1",
		onMessage,
		onOpen,
		onClose,
		onError,
		...overrides
	});
	clients.push(client);
	return { client, ctx, onMessage, onOpen, onClose, onError };
}

function acknowledge(socket: (typeof transport.sockets)[number]): void {
	socket.receive(PWss.Heartbeat.encode({ base: { id: "ack-1", cmd: "heartbeat_ack" } }));
}

beforeEach(() => {
	vi.useFakeTimers();
	transport.sockets.length = 0;
});

afterEach(() => {
	for (const client of clients.splice(0)) client.destroy();
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe("WssClient login and message decoding", () => {
	it("waits for open before authenticating and sends a distinct initial heartbeat", async () => {
		const { client, ctx, onOpen } = makeClient();
		await client.connect();
		const socket = transport.sockets[0];
		expect(socket.url).toBe("ws://example.invalid/socket");
		expect(socket.sent).toEqual([]);
		expect(onOpen).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);

		socket.open();
		expect(socket.sent.map((message) => JSON.parse(message))).toEqual([
			{
				seq: "seq-1",
				cmd: "login",
				data: { userId: "user-1", token: "access-token", platform: "test-platform", deviceId: "device-1" }
			},
			{ seq: "seq-2", cmd: "heartbeat", data: {} }
		]);
		expect(onOpen).toHaveBeenCalledExactlyOnceWith(ctx);
	});

	it.each(["push_message", "edit_message", "blocked_message", "PUSH_MESSAGE"])(
		"decodes the message body for %s rather than just its base envelope",
		async (cmd) => {
			const { client, ctx, onMessage } = makeClient();
			await client.connect();
			const socket = transport.sockets[0];
			socket.open();
			socket.receive(
				PWss.PushMessage.encode({
					base: { id: "envelope-1", cmd },
					data: { value: { msgId: "message-1", chatId: "chat-1", content: { text: "hello", mentionedId: ["user-2"] } } }
				})
			);
			expect(onMessage).toHaveBeenCalledExactlyOnceWith(
				ctx,
				expect.objectContaining({
					base: { id: "envelope-1", cmd },
					data: expect.objectContaining({
						value: expect.objectContaining({
							msgId: "message-1",
							chatId: "chat-1",
							content: expect.objectContaining({ text: "hello", mentionedId: ["user-2"] })
						})
					})
				}),
				cmd
			);
		}
	);

	it("decodes draft and bot board payloads using their distinct message schemas", async () => {
		const { client, onMessage } = makeClient();
		await client.connect();
		const socket = transport.sockets[0];
		socket.open();
		socket.receive(
			PWss.DraftInput.encode({
				base: { cmd: "draft_input" },
				data: { value: { chatId: "chat-1", input: "draft text" } }
			})
		);
		socket.receive(
			PWss.BotBoardMessage.encode({
				base: { cmd: "bot_board_message" },
				data: { value: { botId: "bot-1", chatId: "chat-2", content: "board text", contentType: 1 } }
			})
		);
		expect(onMessage.mock.calls.map(([, message, cmd]) => ({ value: message.data.value, cmd }))).toEqual([
			{ value: expect.objectContaining({ chatId: "chat-1", input: "draft text" }), cmd: "draft_input" },
			{
				value: expect.objectContaining({ botId: "bot-1", chatId: "chat-2", content: "board text", contentType: 1 }),
				cmd: "bot_board_message"
			}
		]);
	});

	it.each(["invite_apply", "future_command"])("keeps a base-only %s message readable", async (cmd) => {
		const { client, ctx, onMessage } = makeClient();
		await client.connect();
		transport.sockets[0].open();
		transport.sockets[0].receive(PWss.Heartbeat.encode({ base: { id: "event-1", cmd } }));
		expect(onMessage).toHaveBeenCalledExactlyOnceWith(ctx, { base: { id: "event-1", cmd } }, cmd);
	});

	it("accepts string transport data without losing the protobuf envelope", async () => {
		const { client, ctx, onMessage } = makeClient();
		await client.connect();
		transport.sockets[0].open();
		// An ASCII-only protobuf payload survives the string-to-Buffer transport conversion.
		const raw = PWss.Heartbeat.encode({ base: { id: "event-1", cmd: "invite_apply" } });
		transport.sockets[0].receive(raw.toString());
		expect(onMessage).toHaveBeenCalledExactlyOnceWith(
			ctx,
			{ base: { id: "event-1", cmd: "invite_apply" } },
			"invite_apply"
		);
	});

	it("returns malformed protobuf as raw hex without poisoning subsequent messages", async () => {
		const { client, ctx, onMessage } = makeClient();
		await client.connect();
		const socket = transport.sockets[0];
		socket.open();
		// The envelope is valid, but a uint64 timestamp ends in an unterminated varint.
		const malformed = Buffer.concat([
			PWss.Heartbeat.encode({ base: { cmd: "push_message" } }),
			Buffer.from([0x12, 0x04, 0x12, 0x02, 0x40, 0x80])
		]);
		socket.receive(malformed);
		expect(onMessage).toHaveBeenCalledExactlyOnceWith(ctx, malformed.toString("hex"), false);
		socket.receive(PWss.Heartbeat.encode({ base: { id: "valid-1", cmd: "invite_apply" } }));
		expect(onMessage).toHaveBeenLastCalledWith(ctx, { base: { id: "valid-1", cmd: "invite_apply" } }, "invite_apply");
	});
});

describe("WssClient heartbeats and reconnects", () => {
	it("terminates exactly at the response deadline and reconnects after the configured delay", async () => {
		const { client, ctx, onClose, onOpen } = makeClient();
		await client.connect();
		const first = transport.sockets[0];
		first.open();
		await vi.advanceTimersByTimeAsync(34);
		expect(first.terminateCalls).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(first.terminateCalls).toBe(1);
		expect(onClose).toHaveBeenCalledExactlyOnceWith(ctx, 1006, "");
		await vi.advanceTimersByTimeAsync(19);
		expect(transport.sockets).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(transport.sockets).toHaveLength(2);

		const second = transport.sockets[1];
		expect(second.sent).toEqual([]);
		second.open();
		acknowledge(second);
		expect(second.sent.map((message) => JSON.parse(message))).toEqual([
			{
				seq: "seq-3",
				cmd: "login",
				data: { userId: "user-1", token: "access-token", platform: "test-platform", deviceId: "device-1" }
			},
			{ seq: "seq-4", cmd: "heartbeat", data: {} }
		]);
		expect(onOpen).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(100);
		expect(second.sent.map((message) => JSON.parse(message).cmd)).toEqual(["login", "heartbeat", "heartbeat"]);
		expect(first.sent).toHaveLength(2);
	});

	it("acknowledges each heartbeat without cancelling the recurring heartbeat schedule", async () => {
		const { client, ctx, onMessage } = makeClient();
		await client.connect();
		const socket = transport.sockets[0];
		socket.open();
		acknowledge(socket);
		expect(onMessage).toHaveBeenCalledWith(ctx, { base: { id: "ack-1", cmd: "heartbeat_ack" } }, "heartbeat_ack");
		await vi.advanceTimersByTimeAsync(99);
		expect(socket.sent).toHaveLength(2);
		expect(socket.terminateCalls).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(JSON.parse(socket.sent[2])).toEqual({ seq: "seq-3", cmd: "heartbeat", data: {} });
		acknowledge(socket);
		await vi.advanceTimersByTimeAsync(35);
		expect(socket.terminateCalls).toBe(0);
		await vi.advanceTimersByTimeAsync(65);
		expect(socket.sent).toHaveLength(4);
		await vi.advanceTimersByTimeAsync(35);
		expect(socket.terminateCalls).toBe(1);
	});

	it("does not treat ordinary inbound traffic as a heartbeat acknowledgement", async () => {
		const { client } = makeClient();
		await client.connect();
		const socket = transport.sockets[0];
		socket.open();
		socket.receive(PWss.PushMessage.encode({ base: { cmd: "push_message" }, data: { value: { msgId: "message-1" } } }));
		await vi.advanceTimersByTimeAsync(35);
		expect(socket.terminateCalls).toBe(1);
	});

	it("honors explicit heartbeat and reconnect intervals on a remotely closed connection", async () => {
		const { client, ctx, onClose } = makeClient({ heartbeatIntervalMs: 200, reconnectDelayMs: 70 });
		await client.connect();
		const first = transport.sockets[0];
		first.open();
		acknowledge(first);
		await vi.advanceTimersByTimeAsync(199);
		expect(first.sent).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(1);
		expect(first.sent).toHaveLength(3);
		first.disconnect(1001, Buffer.from("maintenance"));
		expect(onClose).toHaveBeenCalledExactlyOnceWith(ctx, 1001, "maintenance");
		await vi.advanceTimersByTimeAsync(69);
		expect(transport.sockets).toHaveLength(1);
		expect(first.terminateCalls).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(transport.sockets).toHaveLength(2);
	});

	it("notifies connection errors but waits for close before scheduling a retry", async () => {
		const { client, ctx, onError } = makeClient();
		await client.connect();
		const first = transport.sockets[0];
		const error = new Error("transport disconnected");
		first.fail(error);
		expect(onError).toHaveBeenCalledExactlyOnceWith(ctx, error);
		await vi.advanceTimersByTimeAsync(1000);
		expect(transport.sockets).toHaveLength(1);
		expect(first.sent).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
		first.disconnect();
		await vi.advanceTimersByTimeAsync(20);
		expect(transport.sockets).toHaveLength(2);
		transport.sockets[1].open();
		expect(transport.sockets[1].sent.map((message) => JSON.parse(message).cmd)).toEqual(["login", "heartbeat"]);
	});
});

describe("WssClient destruction", () => {
	it("rejects connecting after destruction without opening a transport", async () => {
		const { client } = makeClient();
		client.destroy();
		await expect(client.connect()).rejects.toBeInstanceOf(Error);
		expect(transport.sockets).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it.each(["connecting", "open", "reconnect pending"])(
		"cleans up the %s lifecycle without reconnecting",
		async (state) => {
			const { client } = makeClient();
			await client.connect();
			const socket = transport.sockets[0];
			if (state !== "connecting") socket.open();
			if (state === "reconnect pending") socket.disconnect();
			client.destroy();
			client.destroy();
			expect(socket.closeCalls).toBe(1);
			expect(vi.getTimerCount()).toBe(0);
			await vi.advanceTimersByTimeAsync(1000);
			expect(socket.terminateCalls).toBe(0);
			expect(transport.sockets).toHaveLength(1);
			await expect(client.connect()).rejects.toBeInstanceOf(Error);
		}
	);
});
