import { BASE_URL, TV1RequestBase, ILogger, TWebRequestBase } from "../../../../types.ts";
import { request } from "../../../../utils/http.ts";
import protoFile from "../../../../protos/friend.proto";
import protoSend from "../../../../protos/friend_send.proto";
import protobuf from "protobufjs";
import { TAddressBookList, TAddressBookListSend } from "./friend_types.ts";
import { generateRequestID } from "../request.ts";

export async function getAddressBookList(log: ILogger): Promise<TAddressBookList | undefined> {
	const InfoSend = protobuf.parse(protoSend).root.lookupType("api.friend.address_book_list_send");

	const payload: TAddressBookListSend = { number: generateRequestID() };

	const buffer = InfoSend.encode(InfoSend.create(payload)).finish();

	const response = await request<TAddressBookList, TV1RequestBase>(
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

export async function deleteFriend(
	id: string,
	chatType: 1 | 2 | 3,
	log: ILogger
): Promise<TWebRequestBase | undefined> {
	const body = { chatId: id, chatType };

	const response = await request<TWebRequestBase, TWebRequestBase>(
		`${BASE_URL.v1}friend/delete-friend`,
		{ method: "POST", headers: { token: global.accountData.token }, body: JSON.stringify(body) },
		global.appConfig.network.httpTimeoutMs,
		log
	);
	if (response.success && response.data.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) {
		log.debug("Failed:", response.data);
		return response.data;
	} else if (!response.isError && typeof response.error !== "string") {
		log.debug("Failed:", response.error);
		return response.error;
	} else log.debug("Failed:", response.error);
	return undefined;
}
