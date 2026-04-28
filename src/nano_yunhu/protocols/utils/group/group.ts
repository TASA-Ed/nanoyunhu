import { ILogger, TV1RequestFailed, BASE_URL, TWebRequestBase } from "../../../../types.ts";
import { request } from "../../../../utils/http.ts";
import protoFile from "../../../../protos/group.proto";
import protoSend from "../../../../protos/group_send.proto";
import protobuf from "protobufjs";
import { TGroupInfo, TGroupInfoSend } from "./group_types.ts";
import { TMessageTypeValues } from "../../../message/message.ts";
import { deleteFriend } from "../friend/friend.ts";

export async function getGroup(id: string, log: ILogger): Promise<TGroupInfo | undefined> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.group.info_send");

	// !!! protobufjs 会自动转 groupId 为 group_id
	const payload: TGroupInfoSend = { groupId: id };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<TGroupInfo, TV1RequestFailed>(
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

	const response = await request<TGroupInfo, TV1RequestFailed>(
		`${BASE_URL.v1}group/dismiss-group`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.group.GroupDismiss" }
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return true;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return false;
}
