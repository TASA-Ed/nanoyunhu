export type TGroupCache = {
	// 群聊名称
	name: string;
	// 群聊简介
	introduction: string;
	// 群聊头像 url
	avatarUrl: string;
	// 进群免审核
	directJoin: boolean;
	// 历史消息
	historyMsg: boolean;
	// 分类名
	categoryName: string;
	// 分类ID
	categoryId: bigint;
	// 是否私有
	private: boolean;
	// 隐藏群成员
	hideGroupMembers: boolean;
};
