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
	private missedHeartbeatCount = 0;
	private readonly maxMissedHeartbeatCount = 2;

	// ─── protobuf 类型 ───────────────────────────────────────────────────────────────

	// heartbeat_ack_info 心跳包
	private HeartbeatAckInfo: protobuf.Type | null = null;
	// push_message 推送消息
	private PushMessage: protobuf.Type | null = null;
	// draft_input 草稿同步
	private DraftInput: protobuf.Type | null = null;
	// file_send_message 超级文件分享
	private FileSendMessage: protobuf.Type | null = null;
	// edit_message 编辑消息
	private EditMessage: protobuf.Type | null = null;

	// ── 初始化 ───────────────────────────────────────────────────────────────────────
	constructor(config: WssClientConfig) {
		const i = getIdAndPlatform(log);
		this.config = {
			platform: i.platform,
			deviceId: i.deviceId,
			heartbeatIntervalMs: global.appConfig.network.websocketHeartbeatIntervalMs,
			reconnectDelayMs: global.appConfig.network.websocketReconnectDelayMs,
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
		const root = await protobuf.load(resolve("./src/protos/websocket.proto"));
		this.HeartbeatAckInfo = root.lookupType("wss.heartbeat_ack_info");
		this.PushMessage = root.lookupType("wss.push_message");
		this.DraftInput = root.lookupType("wss.draft_input");
		this.FileSendMessage = root.lookupType("wss.file_send_message");
		this.EditMessage = root.lookupType("wss.edit_message");
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
		this.missedHeartbeatCount += 1;
		log.info("[WssClient] 发送心跳包");
		if (this.missedHeartbeatCount >= this.maxMissedHeartbeatCount) {
			this.forceReconnect(
				`连续 ${this.maxMissedHeartbeatCount} 次心跳未收到响应`
			);
		}
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

	// ── cmd → protobuf 类型映射 ──────────────────────────────────────────────────
	// 服务端所有消息的 base.cmd 值对应的完整解码类型
	private readonly cmdTypeMap: Record<string, () => protobuf.Type | null> = {
		// 心跳回包
		heartbeat_ack:    () => this.HeartbeatAckInfo,
		heartbeat:        () => this.HeartbeatAckInfo,
		pong:             () => this.HeartbeatAckInfo,
		// 推送消息
		push_message:     () => this.PushMessage,
		// 草稿同步
		draft_input:      () => this.DraftInput,
		// 超级文件分享
		file_send_message:() => this.FileSendMessage,
		// 编辑消息
		edit_message:     () => this.EditMessage,
	};

	// ── 从原始 Buffer 中提取 base.cmd（探针解码） ────────────────────────────────
	// 所有消息 field-1 都是 Base { id, cmd }，用任意含 base 字段的类型解一次即可
	private probeCmd(raw: Buffer): string | null {
		if (!this.HeartbeatAckInfo) return null;
		try {
			const msg = this.HeartbeatAckInfo.decode(raw);
			const obj = this.HeartbeatAckInfo.toObject(msg, {
				longs: String,
				enums: String,
				defaults: false,
			}) as Record<string, unknown>;
			const base = obj.base as Record<string, unknown> | undefined;
			if (base && typeof base.cmd === "string" && base.cmd) {
				return base.cmd;
			}
		} catch {
			// 后续 fallback 处理
		}
		return null;
	}

	// ── 解析服务端 protobuf 消息 ─────────────────────────────────────────────────
	private decodeMessage(raw: Buffer): unknown {
		if (!this.HeartbeatAckInfo) {
			log.warn("[WssClient] proto 尚未加载，返回原始 Buffer");
			return raw;
		}

		// 探针解码，读出 base.cmd
		const cmd = this.probeCmd(raw);
		log.info(`[WssClient] 探针解码 base.cmd="${cmd ?? "(未知)"}"`);

		// 根据 cmd 选择正确的解码类型
		const typeGetter = cmd ? this.cmdTypeMap[cmd.toLowerCase()] : undefined;
		const targetType: protobuf.Type | null = typeGetter ? typeGetter() : this.HeartbeatAckInfo;

		if (!targetType) {
			log.warn(`[WssClient] cmd="${cmd}" 无对应 proto 类型，降级使用 HeartbeatAckInfo`);
		}

		const type = targetType ?? this.HeartbeatAckInfo!;

		try {
			const msg = type.decode(raw);
			return type.toObject(msg, {
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

	private readCmd(decoded: unknown): string | null {
		if (!decoded || typeof decoded !== "object") return null;
		const obj = decoded as Record<string, unknown>;
		// 服务端消息统一从 base.cmd 读取
		if (obj.base && typeof obj.base === "object") {
			const base = obj.base as Record<string, unknown>;
			if (typeof base.cmd === "string") return base.cmd;
		}
		return null;
	}

	private isHeartbeatAck(decoded: unknown): boolean {
		const cmd = this.readCmd(decoded)?.toLowerCase();
		if (!cmd) return false;
		return cmd.includes("heartbeat") || cmd.includes("pong");
	}

	private forceReconnect(reason: string): void {
		if (this.destroyed) return;
		log.warn(`[WssClient] ${reason}，准备重连`);
		this.stopHeartbeat();
		this.missedHeartbeatCount = 0;

		const current = this.ws;
		if (!current) {
			this.scheduleReconnect();
			return;
		}

		if (
			current.readyState === WebSocket.OPEN ||
			current.readyState === WebSocket.CONNECTING
		) {
			current.terminate();
			return;
		}

		this.scheduleReconnect();
	}

	// ── 建立连接 ─────────────────────────────────────────────────────────────────
	async connect(): Promise<void> {
		if (this.destroyed) throw new Error("WssClient 已销毁");
		await this.loadProto();

		const ws = new WebSocket(this.config.url);
		this.ws = ws;

		ws.on("open", () => {
			log.info("[WssClient] 连接成功:", this.config.url);
			this.missedHeartbeatCount = 0;
			this.sendLogin();
			this.startHeartbeat();
			this.config.onOpen();
		});

		ws.on("message", (raw: Buffer | string) => {
			const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
			const decoded = this.decodeMessage(buf);
			if (this.isHeartbeatAck(decoded)) {
				this.missedHeartbeatCount = 0;
			}
			log.info("[WssClient] 收到消息:", JSON.stringify(decoded, null, 2));
			this.config.onMessage(decoded);
		});

		ws.on("close", (code, reason) => {
			const reasonStr = reason?.toString() ?? "";
			log.warn(`[WssClient] 连接关闭 code=${code} reason=${reasonStr}`);
			this.stopHeartbeat();
			this.missedHeartbeatCount = 0;
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
