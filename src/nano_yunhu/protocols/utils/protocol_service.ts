import { getUser } from "#/nano_yunhu/protocols/utils/user/user.ts";
import {
	forwardMessage,
	getMessageById,
	listMessageByMidSeq,
	sendMessage
} from "#/nano_yunhu/protocols/utils/message/message.ts";
import {
	dismissGroup,
	editGroup,
	getGroup,
	quitGroup,
	setGroupMsgTypeLimit
} from "#/nano_yunhu/protocols/utils/group/group.ts";
import { approveRequest, deleteFriend, getAddressBookList } from "#/nano_yunhu/protocols/utils/friend/friend.ts";
import { Context } from "#/core/context.ts";
import type { InferProtoModelInput } from "@saltify/typeproto";
import { PMsgSend } from "@nanoyunhu/yunhu-protobuf-typeproto";
import { ILogger, TChatTypeValues } from "#/types.ts";
import { TMessageTypeValues } from "#/nano_yunhu/message/message.ts";
import { TGroupCache } from "#/nano_yunhu/protocols/utils/group/group_types.ts";

export class ProtocolService {
	private readonly ctx: Context;

	getUser = (id: string, log: ILogger) => getUser(this.ctx, id, log);

	sendMessage = (send: InferProtoModelInput<typeof PMsgSend.SendMsg>, log: ILogger) => sendMessage(this.ctx, send, log);
	forwardMessage = (
		msgId: string,
		chatType: TChatTypeValues,
		target: { chatId: string; chatType: TChatTypeValues }[],
		log: ILogger
	) => forwardMessage(this.ctx, msgId, chatType, target, log);
	listMessageByMidSeq = (send: InferProtoModelInput<typeof PMsgSend.SendListMessageByMidSeq>, log: ILogger) =>
		listMessageByMidSeq(this.ctx, send, log);
	getMessageById = (msgId: string, chatType: TChatTypeValues, chatId: string, log: ILogger) =>
		getMessageById(this.ctx, msgId, chatType, chatId, log);

	getGroup = (id: string, log: ILogger) => getGroup(this.ctx, id, log);
	setGroupMsgTypeLimit = (id: string, msgType: TMessageTypeValues[], log: ILogger) =>
		setGroupMsgTypeLimit(this.ctx, id, msgType, log);
	dismissGroup = (id: string, log: ILogger) => dismissGroup(this.ctx, id, log);
	quitGroup = (id: string, log: ILogger) => quitGroup(this.ctx, id, log);
	editGroup = (id: string, info: Partial<TGroupCache>, log: ILogger) => editGroup(this.ctx, id, info, log);

	getAddressBookList = (log: ILogger) => getAddressBookList(this.ctx, log);
	deleteFriend = (chatId: string, chatType: TChatTypeValues, log: ILogger) =>
		deleteFriend(this.ctx, chatId, chatType, log);
	approveRequest = (requestId: number, agree: 1 | 2 | 3 | 4, log: ILogger) =>
		approveRequest(this.ctx, requestId, agree, log);

	constructor(ctx: Context) {
		this.ctx = ctx;
	}
}
