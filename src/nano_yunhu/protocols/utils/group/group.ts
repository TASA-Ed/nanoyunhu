import { ILogger, TV1RequestBase, BASE_URL, TWebRequestBase } from "../../../../types.ts";
import { request } from "../../../../utils/http.ts";
import protoFile from "../../../../protos/group.proto";
import protoSend from "../../../../protos/group_send.proto";
import protobuf from "protobufjs";
import { TGroupInfo, TGroupInfoSend } from "./group_types.ts";
import { TMessageTypeValues } from "../../../message/message.ts";
import { deleteFriend } from "../friend/friend.ts";
import { getGroupInfoAsync } from "../../../cached/cached.ts";

export type EditGroupInfo = {
	// 群聊名称
	name?: string;
	// 群聊简介
	introduction?: string;
	// 群聊头像 url
	avatarUrl?: string;
	// 进群免审核, 1为开启
	directJoin?: string;
	// 历史消息, 1为开启
	historyMsg?: string;
	// 分类名
	categoryName?: string;
	// 分类ID
	categoryId?: string;
	// 是否私有,1为私有
	private?: string;
};

export async function getGroup(id: string, log: ILogger): Promise<TGroupInfo | undefined> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.group.info_send");

	// !!! protobufjs 会自动转 groupId 为 group_id
	const payload: TGroupInfoSend = { groupId: id };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<TGroupInfo, TV1RequestBase>(
		`${BASE_URL.v1}group/info`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.group.GroupInfo" }
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}

export async function setGroupMsgTypeLimit(id: string, msgType: TMessageTypeValues[], log: ILogger): Promise<boolean> {
	const body = { groupId: id, type: msgType.join(",") };

	const response = await request<TWebRequestBase, TWebRequestBase>(
		`${BASE_URL.v1}group/msg-type-limit`,
		{ method: "POST", headers: { token: global.accountData.token }, body: JSON.stringify(body) },
		global.appConfig.network.httpTimeoutMs,
		log
	);
	if (response.success && response.data.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}

export async function quitGroup(id: string, log: ILogger): Promise<boolean> {
	const quit = await deleteFriend(id, 2, log);

	if (quit?.code === 1) return true;
	if (quit?.msg?.includes("群主不可退群")) return await dismissGroup(id, log);

	return false;
}

export async function dismissGroup(id: string, log: ILogger): Promise<boolean> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.group.info_send");

	// !!! protobufjs 会自动转 groupId 为 group_id
	const payload: TGroupInfoSend = { groupId: id };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<TV1RequestBase, TV1RequestBase>(
		`${BASE_URL.v1}group/dismiss-group`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.group.GroupBase" }
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}

export async function editGroup(id: string, info: EditGroupInfo, log: ILogger): Promise<boolean> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.group.edit_send");

	const originGroupInfo = await getGroupInfoAsync(id);
	if (!originGroupInfo) return false;

	// !!! protobufjs 会自动转 groupId 为 group_id
	const payload: TGroupInfoSend = { groupId: id, ...originGroupInfo, ...info };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<TV1RequestBase, TV1RequestBase>(
		`${BASE_URL.v1}group/edit-group`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.group.GroupBase" }
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}
