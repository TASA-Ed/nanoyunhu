import { Logger } from "../../../../utils/logger.ts";
import { BASE_URL } from "../../../../types.ts";
import { request } from "../../../../utils/http.ts";
import protoFile from "../../../../protos/friend.proto";
import protoSend from "../../../../protos/friend_send.proto";
import protobuf from "protobufjs";
import { TAddressBookList, TAddressBookListSend } from "./friend_types.ts";
import { generateRequestID } from "../request.ts";

export async function getAddressBookList(log: Logger): Promise<TAddressBookList | undefined> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.friend.address_book_list_send");

	const payload: TAddressBookListSend = { number: generateRequestID() };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<TAddressBookList>(
		`${BASE_URL.v1}friend/address-book-list`,
		{ method: "POST", headers: { token: global.accountData.token }, body: Buffer.from(buffer) },
		global.appConfig.network.httpTimeoutMs,
		log,
		{ protoFile, messageType: "api.friend.address_book_list" }
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}
