// 按钮内部 value 类型
export type TActionValue = {
	param: number;
	type: string;
};

// 单个按钮类型
export type TActionItem = {
	text: string;
	actionType: number;
	url: string;
	value: string | TActionValue; // 初始解析为 string，后续可转化为对象
};

// 按钮列表类型
export type TButtonData = TActionItem[][];
