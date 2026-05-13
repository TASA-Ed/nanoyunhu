import { TProtoBase } from "../../../../types.ts";

/**
 * 群聊数据发送
 */
export type TGroupInfoSend = {
	readonly groupId: string;
};

/**
 * 群聊数据响应消息
 */
export type TGroupInfo = {
	/** 状态信息 */
	readonly status: TProtoBase;
	/** 群聊数据详情 */
	readonly data: TGroupData;
	/** 群聊 Bot */
	readonly historyBot?: TBotData[];
};

/**
 * 群聊数据 (对应 GroupInfo.GroupData)
 */
export type TGroupData = {
	groupId: string;
	name: string;
	avatarUrl: string;
	/** 头像ID (uint64) */
	avatarId: string;
	introduction: string;
	/** 群人数 (uint64) */
	member: string;
	createdBy: string;
	/** 进群免审核 (uint64) */
	directJoin: string;
	/** 权限等级 (uint64) */
	permissionLevel: string;
	/** 历史消息 (uint64) */
	historyMsg: string;
	/** 分类名 */
	categoryName: string;
	/** 分类ID (uint64) */
	categoryId: string;
	/** 是否为私有群聊 (uint64) */
	private: string;
	/** 免打扰 (uint64) */
	doNotDisturb: string;
	communityId: string;
	communityName: string;
	/** 会话置顶 (uint64) */
	top: string;
	admin: string[];
	/** 被限制的消息类型,例如 "1,2,3" */
	limitedMsgType: string;
	owner: string;
	/** 是否加入群推荐 (uint64) */
	recommendation: string;
	/** 标签(旧版) */
	tagOld: string[];
	tag: TTag[];
	/** 我的群昵称 */
	myGroupNickname: string;
	/** 群口令 */
	groupCode: string;
	/** 隐藏群成员（开启时为1）(uint64) */
	hideGroupMembers: string;
	/** 消息自动销毁时间 (uint64) */
	autoDeleteMessage: string;
	/** 禁止群成员上传文件到群云盘（开启时为1）(uint64) */
	denyMembersUploadToGroupDisk: string;
};

/**
 * 已使用标签信息 (对应 GroupInfo.GroupData.Tag)
 */
export type TTag = {
	/** 标签ID (uint64) */
	id: string;
	text: string;
	color: string;
};

/**
 * 群聊中使用过的机器人数据 (对应 GroupInfo.BotData)
 */
export type TBotData = {
	id: string;
	name: string;
	/** 机器人名称在数据库中序列 (uint64) */
	nameId: string;
	avatarUrl: string;
	avatarId: string;
	introduction: string;
	createdBy: string;
	/** 创建时间 (uint64) */
	createTime: string;
	/** 使用人数 (uint64) */
	userNumber: string;
	/** 是否为私有机器人 (uint64) */
	private: string;
};

export type TGroupCache = {
	// 群聊名称
	name: string;
	// 群聊简介
	introduction: string;
	// 群聊头像 url
	avatarUrl: string;
	// 进群免审核, 1为开启
	directJoin: string;
	// 历史消息, 1为开启
	historyMsg: string;
	// 分类名
	categoryName: string;
	// 分类ID
	categoryId: string;
	// 是否私有,1为私有
	private: string;
};
