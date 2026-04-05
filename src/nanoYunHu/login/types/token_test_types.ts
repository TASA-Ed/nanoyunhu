import { TProtoBase } from "../../../types.ts";

/**
 * 自身信息（V1 protobuf）
 */
export type TSelfInfoV1 = {
	readonly status?: TProtoBase;
	readonly data?: TSelfInfo;
};
/**
 * 自身信息（Web json）
 */
export type TSelfInfoWeb = {
	// 1 为成功
	readonly code: number;
	readonly data: {
		readonly user: {
			readonly userId: string;
			readonly nickname: string;
			readonly phone: string;
			readonly avatarId: string;
			readonly avatarUrl: string;
			readonly goldCoinAmount: number;
		};
	};
	readonly msg: string;
};

type TSelfInfo = {
	readonly userId: string;
	readonly nickname: string;
	readonly avatar_url: string;
	readonly avatar_id: string | bigint;
	readonly phone: string;
	readonly email: string;
	readonly coin: number;
	readonly is_vip: number;
	readonly vip_expired_time: string | bigint;
	readonly invitation_code: string;
};
