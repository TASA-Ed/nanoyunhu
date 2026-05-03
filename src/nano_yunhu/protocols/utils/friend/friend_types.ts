import { TProtoBase } from "../../../../types.ts";

/**
 * 聊天对话列表发送
 */
export type TAddressBookListSend = {
	readonly number: string;
};

/** 聊天对话列表 */
export type TAddressBookList = {
	status: TProtoBase;
	data: TAddressBookData[];
};

/** 聊天分类数据 */
export type TAddressBookData = {
	/** 聊天对象列表名称，为"用户"，"我加入的群聊"，"机器人" */
	list_name: string;
	data: TAddressBookDataList[];
};

/** 聊天对象具体数据 */
export type TAddressBookDataList = {
	/** 聊天对象ID */
	chatId: string;
	/** 聊天对象名称 */
	name: string;
	/** 聊天对象头像url */
	avatarUrl: string;
	/**
	 * 群权限等级
	 * 普通用户无此项(数值为0或无此项), 群主100, 管理员2
	 * 只有群列表才有此项
	 */
	permissonLevel?: number;
	/** 聊天对象 ID 2(可能备注) */
	chatId2: string;
};
