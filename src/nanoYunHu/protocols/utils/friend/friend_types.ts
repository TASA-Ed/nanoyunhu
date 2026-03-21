import { ProtoBase } from "../../../../types.ts";

/**
 * 聊天对话列表发送
 */
export interface AddressBookListSend {
	readonly number: string;
}

/** 聊天对话列表 */
export interface AddressBookList {
	status: ProtoBase;
	data: AddressBookData[];
}

/** 聊天分类数据 */
export interface AddressBookData {
	/** 聊天对象列表名称，为"用户"，"我加入的群聊"，"机器人" */
	list_name: string;
	data: AddressBookDataList[];
}

/** 聊天对象具体数据 */
export interface AddressBookDataList {
	/** 聊天对象ID */
	chat_id: string;
	/** 聊天对象名称 */
	name: string;
	/** 聊天对象头像url */
	avatar_url: string;
	/**
	 * 群权限等级
	 * 普通用户无此项(数值为0或无此项), 群主100, 管理员2
	 * 只有群列表才有此项
	 */
	permisson_level?: number;
	/** 聊天对象 ID 2 */
	chat_id2: string;
}
