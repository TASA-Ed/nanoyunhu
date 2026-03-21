import { Logger } from "../../../../utils/logger.ts";
import { BASE_URL } from "../../../../types.ts";
import { request } from "../../../../utils/http.ts";
import protoFile from "../../../../protos/group.proto";
import protoSend from "../../../../protos/group-send.proto";
import protobuf from "protobufjs";
import { GroupInfo, GroupInfoSend } from "./group_types.ts";

export async function getGroup(id: string, log: Logger): Promise<GroupInfo | undefined> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.group.info_send");

	// !!! protobufjs 会自动转 groupId 为 group_id
	const payload: GroupInfoSend = { groupId: id };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<GroupInfo>(
		`${BASE_URL.v1}group/info`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.group.GroupInfo" }
	);
	if (response.success && response.data.status.code === 1) {
		log.debug("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}
