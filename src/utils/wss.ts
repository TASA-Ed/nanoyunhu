import WebSocket from "ws";
import protobuf from "protobufjs";
import { resolve } from "node:path";
import { getIdAndPlatform } from "./device.ts";
import { Logger } from "./logger.ts";

const log = new Logger({ prefix: "WebSocket" });

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export interface WssClientConfig {
	url: string;
	userId: string;
	token: string;
	platform?: string;
	deviceId?: string;
	heartbeatIntervalMs?: number; // 心跳间隔，默认 30000ms
	reconnectDelayMs?: number;    // 重连延迟，默认 5000ms
	onMessage?: (data: unknown) => void;
	onOpen?: () => void;
	onClose?: (code: number, reason: string) => void;
	onError?: (err: Error) => void;
}

// ─── 生成唯一 seq ────────────────────────────────────────────────────────────

function genSeq(): string {
	return `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
}

// ─── WssClient ───────────────────────────────────────────────────────────────

export class WssClient {
	private readonly config: Required<WssClientConfig>;
	private ws: WebSocket | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private destroyed = false;

	// protobuf 类型（懒加载）
	private HeartbeatAckInfo: protobuf.Type | null = null;

	constructor(config: WssClientConfig) {
		const i = getIdAndPlatform(log);
		this.config = {
			platform: i.platform,
			deviceId: i.deviceId,
			heartbeatIntervalMs: 30_000,
			reconnectDelayMs: 5_000,
			onMessage: () => {},
			onOpen: () => {},
			onClose: () => {},
			onError: () => {},
			...config,
		};
	}

	// ── 初始化 protobuf 解析器 ──────────────────────────────────────────────────
	private async loadProto(): Promise<void> {
		if (this.HeartbeatAckInfo) return;
		const root = await protobuf.load(resolve("./src/protos/heart.proto"));
		this.HeartbeatAckInfo = root.lookupType("ws.heartbeat_ack_info");
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
			data: { userId, token, platform, deviceId },
		});
		log.info("[WssClient] 已发送登录请求");
	}

	// ── 心跳 ────────────────────────────────────────────────────────────────────
	private sendHeartbeat(): void {
		this.sendJson({
			seq: genSeq(),
			cmd: "heartbeat",
			data: {},
		});
		log.info("[WssClient] 发送心跳包");
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(
			() => this.sendHeartbeat(),
			this.config.heartbeatIntervalMs
		);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer !== null) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	// ── 解析服务端 protobuf 消息 ─────────────────────────────────────────────────
	private decodeMessage(raw: Buffer): unknown {
		if (!this.HeartbeatAckInfo) {
			log.warn("[WssClient] proto 尚未加载，返回原始 Buffer");
			return raw;
		}
		try {
			const msg = this.HeartbeatAckInfo.decode(raw);
			return this.HeartbeatAckInfo.toObject(msg, {
				longs: String,
				enums: String,
				defaults: true,
			});
		} catch (e) {
			log.warn("[WssClient] protobuf 解码失败，尝试解析为 JSON", e);
			try {
				return JSON.parse(raw.toString("utf8"));
			} catch {
				return raw.toString("utf8");
			}
		}
	}

	// ── 建立连接 ─────────────────────────────────────────────────────────────────
	async connect(): Promise<void> {
		if (this.destroyed) throw new Error("WssClient 已销毁");
		await this.loadProto();

		const ws = new WebSocket(this.config.url);
		this.ws = ws;

		ws.on("open", () => {
			log.info("[WssClient] 连接成功:", this.config.url);
			this.sendLogin();
			this.startHeartbeat();
			this.config.onOpen();
		});

		ws.on("message", (raw: Buffer | string) => {
			const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
			const decoded = this.decodeMessage(buf);
			log.info("[WssClient] 收到消息:", JSON.stringify(decoded, null, 2));
			this.config.onMessage(decoded);
		});

		ws.on("close", (code, reason) => {
			const reasonStr = reason?.toString() ?? "";
			log.warn(`[WssClient] 连接关闭 code=${code} reason=${reasonStr}`);
			this.stopHeartbeat();
			this.config.onClose(code, reasonStr);
			if (!this.destroyed) this.scheduleReconnect();
		});

		ws.on("error", (err: Error) => {
			log.error("[WssClient] 错误:", err.message);
			this.config.onError(err);
		});
	}

	// ── 自动重连 ─────────────────────────────────────────────────────────────────
	private scheduleReconnect(): void {
		if (this.reconnectTimer !== null || this.destroyed) return;
		log.info(
			`[WssClient] ${this.config.reconnectDelayMs}ms 后尝试重连...`
		);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect().catch((e) =>
				log.error("[WssClient] 重连失败:", e)
			);
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
		log.info("[WssClient] 已销毁");
	}
}