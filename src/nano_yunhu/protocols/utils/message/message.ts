import type { TSendMessage } from "./message_types.ts";
import { request } from "../../../../utils/http.ts";
import { BASE_URL, type ILogger, type TProtoBase } from "../../../../types.ts";
import protoFile from "../../../../protos/message_send.proto";
import protobuf from "protobufjs";
import { Logger } from "../../../../utils/logger.ts";
import { generateMsgID } from "../../../../utils/generate.ts";
import { getSystemInfo } from "../../../../utils/device.ts";
import { formatTimestampDiff } from "../../../../utils/time.ts";

export async function sendMessage(send: TSendMessage, log: ILogger): Promise<{ status: TProtoBase } | undefined> {
	const InfoSend = protobuf.parse(protoFile).root.lookupType("api.message.send_message_send");

	const buffer = InfoSend.encode(InfoSend.create(send)).finish();

	const response = await request<{ status: TProtoBase }, { status: TProtoBase }>(
		`${BASE_URL.v1}msg/send-message`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.message.send_message" }
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}

export async function pluginStatus(chatId: string, chatType: string): Promise<boolean> {
	const log = new Logger({ prefix: "PluginStatus" });
	const info = getSystemInfo();
	const msg = {
		msgId: generateMsgID(),
		chatId,
		chatType,
		contentType: "1",
		data: {
			text: `NanoYunHu 信息\n版本: ${global.accountData.appVersion}\n平台: ${info.type} ${info.release} (${info.arch})\n运行时间: ${formatTimestampDiff(global.accountData.timestamp, Number(new Date().getTime().toString().substring(0, 10)))}`
		}
	};
	const send = await sendMessage(msg, log);
	if (!send) {
		log.warn("Message send failed:", msg);
		return false;
	}
	return true;
}
