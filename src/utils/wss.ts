import WebSocket from "ws";
import { Logger } from "./logger.ts";
import { PWss } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { ProtoMessage, InferProtoModel } from "@saltify/typeproto";
import type { Context } from "#/core/context.ts";

const log = new Logger({ prefix: "WssClient" });

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export interface IWssClient {
	url: string;
	userId: string;
	token: string;
	platform: string;
	deviceId: string;
	heartbeatIntervalMs?: number; // 心跳间隔，默认 30000ms
	reconnectDelayMs?: number; // 重连延迟，默认 5000ms
	onMessage?: (ctx: Context, data: unknown, cmd: PWss.CmdMap | false) => void;
	onOpen?: (ctx: Context) => void;
	onClose?: (ctx: Context, code: number, reason: string) => void;
	onError?: (ctx: Context, err: Error) => void;
}

// ─── 生成唯一 seq ────────────────────────────────────────────────────────────

function genSeq(): string {
	return `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
}

// ─── WssClient ───────────────────────────────────────────────────────────────

export class WssClient {
	private readonly config: Required<IWssClient>;
	private readonly ctx: Context;
	private ws: WebSocket | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private destroyed = false;
	private missedHeartbeatCount = 0;
	private readonly maxMissedHeartbeatCount = 2;

	// ── 初始化 ───────────────────────────────────────────────────────────────────────
	constructor(ctx: Context, config: IWssClient) {
		this.ctx = ctx;
		this.config = {
			heartbeatIntervalMs: this.ctx.appConfig.network.websocketHeartbeatIntervalMs,
			reconnectDelayMs: this.ctx.appConfig.network.websocketReconnectDelayMs,
			onMessage: () => {},
			onOpen: () => {},
			onClose: () => {},
			onError: () => {},
			...config
		};
	}

	// ── 发送 JSON 消息 ──────────────────────────────────────────────────────────
	private sendJson(payload: object): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(payload));
		}
	}

	// ── 登录 ────────────────────────────────────────────────────────────────────
	private sendLogin(): void {
		const { userId, token, platform, deviceId } = this.config;
		this.sendJson({
			seq: genSeq(),
			cmd: "login",
			data: { userId, token, platform, deviceId }
		});
		log.info("已发送登录请求");
	}

	// ── 心跳 ────────────────────────────────────────────────────────────────────
	private sendHeartbeat(): void {
		this.sendJson({
			seq: genSeq(),
			cmd: "heartbeat",
			data: {}
		});
		this.missedHeartbeatCount += 1;
		log.debug("发送心跳包");
		if (this.missedHeartbeatCount >= this.maxMissedHeartbeatCount) {
			this.forceReconnect(`连续 ${this.maxMissedHeartbeatCount} 次心跳未收到响应`);
		}
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.config.heartbeatIntervalMs);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer !== null) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	// ── 根据 cmd 获取对应的解码器 ──────────────────────────────────────────────────
	private getDecoderForCmd(cmd: string): ProtoMessage<any> | null {
		const cmdLower = cmd.toLowerCase() as PWss.CmdMap;
		switch (cmdLower) {
			case "heartbeat_ack":
				return PWss.Heartbeat;
			case "push_message":
				return PWss.PushMessage;
			case "draft_input":
				return PWss.DraftInput;
			case "edit_message":
				return PWss.PushMessage;
			case "invite_apply":
				return PWss.Heartbeat;
			case "bot_board_message":
				return PWss.BotBoardMessage;
			case "blocked_message":
				return PWss.PushMessage;
			default:
				return null;
		}
	}

	// ── 从原始 Buffer 中提取 base.cmd（探针解码） ────────────────────────────────
	// 所有消息 field-1 都是 Base { id, cmd }，用任意含 base 字段的类型解一次即可
	private probeCmd(raw: Buffer): string | null {
		try {
			const msg = PWss.Heartbeat.decode(raw);
			if (msg.base && typeof msg.base.cmd === "string" && msg.base.cmd) {
				return msg.base.cmd;
			}
		} catch (e: unknown) {
			log.debug(e);
		}
		return null;
	}

	// ── 解析服务端 protobuf 消息 ─────────────────────────────────────────────────
	private decodeMessage(raw: Buffer): unknown {
		log.trace("Raw Hex:", raw.toString("hex"));
		// 探针解码，读出 base.cmd
		const cmd = this.probeCmd(raw);
		log.trace(`探针解码 base.cmd="${cmd ?? "(未知)"}"`);

		// 根据 cmd 选择正确的解码器
		const decoder = cmd ? this.getDecoderForCmd(cmd) : null;

		if (!decoder) {
			log.warn(`cmd="${cmd}" 无对应 proto 类型，降级使用 HeartbeatAckInfo`);
			log.debug("Raw Hex:", raw.toString("hex"));
		}

		// 使用对应的解码器或降级到心跳解码器
		const finalDecoder = decoder ?? PWss.Heartbeat;

		try {
			// typeproto 的 decode 函数直接返回解码后的对象
			return finalDecoder.decode(raw);
		} catch (e) {
			log.warn("protobuf 解码失败，返回 Raw Hex。", e);
			return raw.toString("hex");
		}
	}

	private readCmd(decoded: unknown): PWss.CmdMap | null {
		if (!decoded || typeof decoded !== "object") return null;
		const obj = decoded as Record<string, unknown>;
		// 服务端消息统一从 base.cmd 读取
		if (obj.base && typeof obj.base === "object") {
			const base = obj.base as InferProtoModel<typeof PWss.Base>;
			if (typeof base.cmd === "string") return base.cmd as PWss.CmdMap;
		}
		return null;
	}

	private isHeartbeatAck(cmd: PWss.CmdMap | null): boolean {
		if (!cmd) return false;
		return cmd.includes("heartbeat_ack");
	}

	private forceReconnect(reason: string): void {
		if (this.destroyed) return;
		log.warn(`${reason}，准备重连`);
		this.stopHeartbeat();
		this.missedHeartbeatCount = 0;

		const current = this.ws;
		if (!current) {
			this.scheduleReconnect();
			return;
		}

		if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
			current.terminate();
			return;
		}

		this.scheduleReconnect();
	}

	// ── 建立连接 ─────────────────────────────────────────────────────────────────
	async connect(): Promise<void> {
		if (this.destroyed) throw new Error("WssClient 已销毁");

		const ws = new WebSocket(this.config.url);
		this.ws = ws;

		ws.on("open", () => {
			log.info("连接成功:", this.config.url);
			this.missedHeartbeatCount = 0;
			this.sendLogin();
			this.startHeartbeat();
			this.config.onOpen(this.ctx);
		});

		ws.on("message", (raw: Buffer | string) => {
			const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
			const decoded = this.decodeMessage(buf);
			const cmd = this.readCmd(decoded);
			if (this.isHeartbeatAck(cmd)) {
				this.missedHeartbeatCount = 0;
				log.debug("收到心跳包");
			}
			log.trace("收到消息:", decoded);
			this.config.onMessage(this.ctx, decoded, cmd ?? false);
		});

		ws.on("close", (code, reason) => {
			const reasonStr = reason?.toString() ?? "";
			log.warn(`连接关闭 code=${code} reason=${reasonStr}`);
			this.stopHeartbeat();
			this.missedHeartbeatCount = 0;
			this.config.onClose(this.ctx, code, reasonStr);
			if (!this.destroyed) this.scheduleReconnect();
		});

		ws.on("error", (err: Error) => {
			log.error("错误:", err.message);
			this.config.onError(this.ctx, err);
		});
	}

	// ── 自动重连 ─────────────────────────────────────────────────────────────────
	private scheduleReconnect(): void {
		if (this.reconnectTimer !== null || this.destroyed) return;
		log.info(`${this.config.reconnectDelayMs}ms 后尝试重连...`);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect().catch((e) => log.error("重连失败:", e));
		}, this.config.reconnectDelayMs);
	}

	// ── 主动关闭（不重连） ────────────────────────────────────────────────────────
	destroy(): void {
		this.destroyed = true;
		this.stopHeartbeat();
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.ws?.close();
		this.ws = null;
		log.info("已销毁");
	}
}
