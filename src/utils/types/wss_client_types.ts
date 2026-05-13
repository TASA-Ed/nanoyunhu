export type TCmdMap =
	| "heartbeat_ack"
	| "push_message"
	| "draft_input"
	| "file_send_message"
	| "edit_message"
	| "invite_apply";

export type TWssClientMsgBase = {
	/** 消息 ID */
	readonly id?: string;
	/** 返回消息 */
	readonly cmd?: TCmdMap;
};

export type TPushMessage = {
	base?: TWssClientMsgBase;
	data?: TPushMessageData;
};

export type TPushMessageData = {
	felid1?: string;
	// 消息
	msg?: TPushMessageMsg;
};

export type TPushMessageMsg = {
	// 消息 ID
	msgId?: string;
	// 发送者
	sender?: TPushMessageSender;
	// 接收者ID
	receiverId?: string;
	// 会话的ID
	chatId?: string;
	// 会话类型
	chatType?: string;
	// 消息内容
	content?: TPushMessageContent;
	// 消息类型
	contentType?: string;
	// 时间戳(毫秒)
	timestamp?: string;
	// 指令
	cmd?: TPushMessageCmd;
	// 撤回消息时间
	deleteTimestamp?: string;
	// 引用消息ID
	quoteMsgId?: string;
	// 消息序列
	msgSeq?: string;
};

export type TPushMessageCmd = {
	// 命令ID
	id?: string;
	// 命令名称
	name?: string;
};

export type TPushMessageSender = {
	chatId?: string;
	chatType?: string;
	name?: string;
	avatarUrl?: string;
	tagOld?: string[];
	tag?: TPushMessageTag[];
};

export type TPushMessageContent = {
	// 消息内容
	text?: string;
	// 按钮
	buttons?: string;
	// 图片链接
	imageUrl?: string;
	// 文件名称
	fileName?: string;
	// 文件链接
	fileUrl?: string;
	// 表单消息
	form?: string;
	// 引用消息文字
	quoteMsgText?: string;
	// 表情URL
	stickerUrl?: string;
	// 文章ID
	postId?: string;
	// 文章标题
	postTitle?: string;
	// 文章内容
	postContent?: string;
	// 文章类型
	postContentType?: string;
	// 个人表情ID
	expressionId?: string;
	// 引用图片直链
	quoteImageUrl?: string;
	// 引用图片文件名称
	quoteImageName?: string;
	// 文件/图片大小(字节)
	fileSize?: string;
	// 视频URL
	videoUrl?: string;
	// 语音URL
	audioUrl?: string;
	// 语音时长
	audioTime?: string;
	// 引用视频直链
	quoteVideoUrl?: string;
	// 引用视频时长
	quoteVideoTime?: string;
	// 表情ID
	stickerItemId?: string;
	// 表情包ID
	stickerPackId?: string;
	// 语音通话文字
	callText?: string;
	// 语音通话状态文字
	callStatusText?: string;
	// 图片的宽度
	width?: string;
	// 图片的高度
	height?: string;
	// 提示信息
	tip?: string;
};

export type TPushMessageTag = {
	id?: string;
	text?: string;
	color?: string;
};

// 主消息结构
export type TDraftInput = {
	base?: TWssClientMsgBase;
	data?: TDraftInputData;
};

// Data 数据层
export type TDraftInputData = {
	felid1?: string;
	draft?: TDraft;
};

// 草稿详情
export type TDraft = {
	chatId: string;
	input: string;
};

export type TEditMessage = {
	base?: TWssClientMsgBase;
	data?: EditMessageData;
};

export type EditMessageData = {
	felid1?: string;
	msg?: TEditMessageMsg;
};

export type TEditMessageMsg = {
	// 消息 ID
	msgId?: string;
	// 接收者ID
	receiverId?: string;
	// 会话的ID
	chatId?: string;
	// 会话类型
	chatType?: string;
	// 消息内容
	content?: TPushMessageContent;
	// 消息类型
	contentType?: string;
	// 编辑时间
	editTime?: string;
	// 引用消息ID
	quoteMsgId?: string;
};

export type TFileSendMessage = {
	base: TWssClientMsgBase;
	data: TFileSendMessage_Data;
};

export type TFileSendMessage_Data = {
	felid1?: string;
	sender: TFileSendMessage_Sender;
};

export type TFileSendMessage_Sender = {
	sendUserId: string;
	userId: string;
	tempCode: string;
	sendType: string;
	// JSON String
	data: string;
	sendDeviceId: string;
};
