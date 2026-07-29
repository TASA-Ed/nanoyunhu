import { BASE_URL, ILogger, TChatTypeValues, TWebRequestBase } from "#/types.ts";
import { request } from "#/utils/http.ts";
import { PFriend, PFriendSend } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel } from "@saltify/typeproto";
import { generateRequestID } from "#/utils/generate.ts";
import type { Context } from "#/core/context.ts";

/**
 * 获取所有聊天对象
 * @param ctx
 * @param log
 */
export async function getAddressBookList(
	ctx: Context,
	log: ILogger
): Promise<InferProtoModel<typeof PFriend.AddressBookList> | undefined> {
	const buffer = PFriendSend.AddressBookList.encode({ md5: generateRequestID() });

	const response = await request<typeof PFriend.AddressBookList>(
		`${BASE_URL.v1}friend/address-book-list`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: Buffer.from(buffer) },
		log,
		ctx.appConfig.network.httpTimeoutMs,
		PFriend.AddressBookList
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
 * 删除用户/群聊/机器人
 * @param ctx
 * @param chatId 聊天 ID
 * @param chatType 1-用户，2-群聊，3-机器人
 * @param log
 */
export async function deleteFriend(
	ctx: Context,
	chatId: string,
	chatType: TChatTypeValues,
	log: ILogger
): Promise<TWebRequestBase | undefined> {
	const body = { chatId, chatType };

	const response = await request<TWebRequestBase, TWebRequestBase>(
		`${BASE_URL.v1}friend/delete-friend`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: JSON.stringify(body) },
		log,
		ctx.appConfig.network.httpTimeoutMs
	);
	if (response.success && response.data.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) {
		log.debug("Failed:", response.data);
		return response.data;
	} else if (response.kind === "http" && response.isObj) {
		log.debug("Failed:", response.error);
		return response.error;
	} else log.debug("Failed:", response.error);
	return undefined;
}

/**
 * 处理请求
 * @param ctx
 * @param requestId 申请 ID
 * @param agree 1-通过请求，2-拒绝请求，3-显示请求过期，4-显示已解散
 * @param log
 */
export async function approveRequest(
	ctx: Context,
	requestId: number,
	agree: 1 | 2 | 3 | 4,
	log: ILogger
): Promise<TWebRequestBase | undefined> {
	const body = { id: requestId, agree };

	const response = await request<TWebRequestBase, TWebRequestBase>(
		`${BASE_URL.v1}friend/agree-apply`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: JSON.stringify(body) },
		log,
		ctx.appConfig.network.httpTimeoutMs
	);
	if (response.success && response.data.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) {
		log.debug("Failed:", response.data);
		return response.data;
	} else if (response.kind === "http" && response.isObj) {
		log.debug("Failed:", response.error);
		return response.error;
	} else log.debug("Failed:", response.error);
	return undefined;
}
