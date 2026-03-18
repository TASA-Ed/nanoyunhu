/**
 * 用户
 */
export interface User {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly user: {
			readonly userId: string;
			readonly nickname: string;
			readonly avatarUrl: string;
			readonly registerTime: number;
			readonly registerTimeText: string;
			readonly onLineDay: number;
			readonly continuousOnLineDay: number;
			readonly medals: Medal[];
			readonly isVip: number;
		};
	};
	readonly msg: string;
}

/**
 * 勋章
 */
export interface Medal {
	readonly id: number;
	readonly name: string;
	readonly desc: string;
	readonly imageUrl: string;
	readonly sort: number;
}
