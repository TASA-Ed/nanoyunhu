import { ILogger, BASE_URL, TWebRequestBase } from "#/types.ts";
import { request } from "#/utils/http.ts";
import { PGroup, PGroupSend, PV1 } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel } from "@saltify/typeproto";
import { TMessageTypeValues } from "../../../message/message.ts";
import { deleteFriend } from "../friend/friend.ts";
import { getGroupInfoAsync } from "../../../cached/cached.ts";
import { TGroupCache } from "#/nano_yunhu/protocols/utils/group/group_types.ts";
import type { Context } from "#/core/context.ts";

export async function getGroup(
	ctx: Context,
	id: string,
	log: ILogger
): Promise<InferProtoModel<typeof PGroup.GroupInfo> | undefined> {
	const buffer = PGroupSend.GroupInfo.encode({ groupId: id });

	const response = await request<typeof PGroup.GroupInfo>(
		`${BASE_URL.v1}group/info`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: Buffer.from(buffer) },
		log,
		ctx.appConfig.network.httpTimeoutMs,
		PGroup.GroupInfo
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}

export async function setGroupMsgTypeLimit(
	ctx: Context,
	id: string,
	msgType: TMessageTypeValues[],
	log: ILogger
): Promise<boolean> {
	const body = { groupId: id, type: msgType.join(",") };

	const response = await request<TWebRequestBase, TWebRequestBase>(
		`${BASE_URL.v1}group/msg-type-limit`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: JSON.stringify(body) },
		log,
		ctx.appConfig.network.httpTimeoutMs
	);
	if (response.success && response.data.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}

export async function quitGroup(ctx: Context, id: string, log: ILogger): Promise<boolean> {
	const quit = await deleteFriend(ctx, id, 2, log);

	if (quit?.code === 1) return true;
	if (quit?.msg?.includes("群主不可退群")) return await dismissGroup(ctx, id, log);

	return false;
}

export async function dismissGroup(ctx: Context, id: string, log: ILogger): Promise<boolean> {
	const buffer = PGroupSend.GroupInfo.encode({ groupId: id });

	const response = await request<typeof PV1.Base>(
		`${BASE_URL.v1}group/dismiss-group`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: Buffer.from(buffer) },
		log,
		ctx.appConfig.network.httpTimeoutMs,
		PV1.Base
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}

export async function editGroup(ctx: Context, id: string, info: Partial<TGroupCache>, log: ILogger): Promise<boolean> {
	const originGroupInfo = await getGroupInfoAsync(ctx, id);
	if (!originGroupInfo) return false;

	const buffer = PGroupSend.EditGroup.encode({ groupId: id, ...originGroupInfo, ...info });

	const response = await request<typeof PV1.Base>(
		`${BASE_URL.v1}group/edit-group`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: Buffer.from(buffer) },
		log,
		ctx.appConfig.network.httpTimeoutMs,
		PV1.Base
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}
