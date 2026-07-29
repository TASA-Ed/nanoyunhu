import { request } from "#/utils/http.ts";
import { BASE_URL, type ILogger, TChatTypeValues, TWebRequestBase } from "#/types.ts";
import { PMsgSend, PV1, PMsg } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel, InferProtoModelInput } from "@saltify/typeproto";
import type { Context } from "#/core/context.ts";

export async function sendMessage(
	ctx: Context,
	send: InferProtoModelInput<typeof PMsgSend.SendMsg>,
	log: ILogger
): Promise<InferProtoModel<typeof PV1.Base> | undefined> {
	const buffer = PMsgSend.SendMsg.encode(send);

	const response = await request<typeof PV1.Base, InferProtoModel<typeof PV1.Base>>(
		`${BASE_URL.v1}msg/send-message`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: Buffer.from(buffer) },
		log,
		ctx.appConfig.network.httpTimeoutMs,
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

export async function forwardMessage(
	ctx: Context,
	msgId: string,
	chatType: TChatTypeValues,
	target: { chatId: string; chatType: TChatTypeValues }[],
	log: ILogger
): Promise<TWebRequestBase | undefined> {
	const response = await request<TWebRequestBase, TWebRequestBase>(
		`${BASE_URL.v1}msg/msg-forward`,
		{
			method: "POST",
			headers: { token: ctx.accountData.token },
			body: JSON.stringify({ msgId, chatType, receive: target })
		},
		log,
		ctx.appConfig.network.httpTimeoutMs
	);
	if (response.success && response.data.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}

export async function listMessageByMidSeq(
	ctx: Context,
	send: InferProtoModelInput<typeof PMsgSend.SendListMessageByMidSeq>,
	log: ILogger
): Promise<InferProtoModel<typeof PMsg.ListMessageByMidSeq> | undefined> {
	const buffer = PMsgSend.SendListMessageByMidSeq.encode(send);

	const response = await request<typeof PMsg.ListMessageByMidSeq, InferProtoModel<typeof PV1.Base>>(
		`${BASE_URL.v1}msg/list-message-by-mid-seq`,
		{
			method: "POST",
			headers: { token: ctx.accountData.token },
			body: buffer
		},
		log,
		ctx.appConfig.network.httpTimeoutMs,
		PMsg.ListMessageByMidSeq
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}

/**
 * 使用 ID 获取消息的封装函数
 * @description 自动处理请求，自动判断是否成功。
 * @returns 消息体，失败时返回 undefined。
 * @param ctx 上下文
 * @param msgId 消息 ID
 * @param chatType 聊天类型
 * @param chatId 聊天 ID
 * @param log Logger
 */
export async function getMessageById(
	ctx: Context,
	msgId: string,
	chatType: TChatTypeValues,
	chatId: string,
	log: ILogger
): Promise<InferProtoModel<typeof PMsg.ListMessageByMidSeqData> | undefined> {
	const result = await listMessageByMidSeq(
		ctx,
		{
			msgSeq: BigInt(-1),
			chatType,
			chatId,
			msgCount: 1,
			msgId
		},
		log
	);
	if (result && result?.data?.length === 2 && result?.data[1]?.msgId === msgId) {
		return result?.data[1];
	}
	return undefined;
}
