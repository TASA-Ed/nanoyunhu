import { WssClientMsgBase } from "../../types.ts";

export interface PushMessage {
	base?: WssClientMsgBase;
	data?: PushMessageData;
}

export interface PushMessageData {
	any?: string;
	msg?: PushMessageMsg;
}

export interface PushMessageMsg {
	msgId?: string;
	sender?: PushMessageSender;
	recvId?: string; // 接收者ID
	chatId?: string; // 会话的ID
	chatType?: string; // 会话类型
	content?: PushMessageContent; // 消息内容
	contentType?: string;
	timestamp?: string; // 时间戳(毫秒)
	cmd?: PushMessageCmd; // 指令
	deleteTimestamp?: string; // 撤回消息时间
	quoteMsgId?: string; // 引用消息ID
	msgSeq?: string; // 消息序列
}

export interface PushMessageCmd {
	id?: string; // 命令ID
	name?: string; // 命令名称
}

export interface PushMessageSender {
	chatId?: string;
	chatType?: string;
	name?: string;
	avatarUrl?: string;
	tagOld?: string[];
	tag?: PushMessageTag[];
}

export interface PushMessageContent {
	text?: string; // 消息内容
	buttons?: string; // 按钮
	imageUrl?: string;
	fileName?: string;
	fileUrl?: string;
	form?: string; // 表单消息
	quoteMsgText?: string; // 引用消息文字
	stickerUrl?: string; // 表情URL
	postId?: string; // 文章ID
	postTitle?: string; // 文章标题
	postContent?: string; // 文章内容
	postContentType?: string; // 文章类型
	expressionId?: string; // 个人表情ID
	quoteImageUrl?: string; // 引用图片直链
	quoteImageName?: string; // 引用图片文件名称
	fileSize?: string; // 文件/图片大小(字节)
	videoUrl?: string; // 视频URL
	audioUrl?: string; // 语音URL
	audioTime?: string; // 语音时长
	quoteVideoUrl?: string; // 引用视频直链
	quoteVideoTime?: string; // 引用视频时长
	stickerItemId?: string; // 表情ID
	stickerPackId?: string; // 表情包ID
	callText?: string; // 语音通话文字
	callStatusText?: string; // 语音通话状态文字
	width?: string; // 图片的宽度
	height?: string; // 图片的高度
	tip?: string; // 提示信息
}

export interface PushMessageTag {
	id?: string;
	text?: string;
	color?: string;
}
