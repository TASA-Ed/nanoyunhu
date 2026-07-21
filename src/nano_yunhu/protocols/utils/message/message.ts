import { request } from "#/utils/http.ts";
import { BASE_URL, type ILogger } from "#/types.ts";
import { PMsgSend, PV1 } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel, InferProtoModelInput } from "@saltify/typeproto";
import { Logger } from "#/utils/logger.ts";
import { generateMsgID } from "#/utils/generate.ts";
import { getSystemInfo } from "#/utils/device.ts";
import { formatTimestampDiff } from "#/utils/time.ts";

export async function sendMessage(
	send: InferProtoModelInput<typeof PMsgSend.SendMsg>,
	log: ILogger
): Promise<InferProtoModel<typeof PV1.Base> | undefined> {
	const buffer = PMsgSend.SendMsg.encode(send);

	const response = await request<typeof PV1.Base, InferProtoModel<typeof PV1.Base>>(
		`${BASE_URL.v1}msg/send-message`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		log,
		global.appConfig.network.httpTimeoutMs,
		PV1.Base
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}

export async function pluginStatus(chatId: string, chatType: number): Promise<boolean> {
	const log = new Logger({ prefix: "PluginStatus" });
	const info = getSystemInfo();
	const msg = {
		msgId: generateMsgID(),
		chatId,
		chatType: String(chatType),
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
