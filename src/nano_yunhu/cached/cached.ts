import { getGroup } from "../protocols/utils/group/group.ts";
import { Logger } from "../../utils/logger.ts";
import { TUser } from "../protocols/utils/user/user_types.ts";
import { TGroupCache } from "../protocols/utils/group/group_types.ts";
import { getUser } from "../protocols/utils/user/user.ts";
import { ILogger } from "../../types.ts";

const logger = new Logger({ prefix: "Cached" });

const groupNameCache: Record<string, TGroupCache> = {};
// 改为存储 Promise，而非单纯标记
const pendingQueries = new Map<string, Promise<TGroupCache | null>>();

/**
 * 获取群聊名称（后台）
 * @description 后台查询并缓存，未命中时返回群号本身（不阻塞）
 * */
export function getGroupName(groupId: string): string {
	const log = logger.child("GroupName");

	if (groupNameCache[groupId]) {
		return groupNameCache[groupId].name;
	}

	if (!pendingQueries.has(groupId)) queryGroup(groupId, log);
	return groupId;
}

/**
 * 获取群聊信息（立即）
 * @description 立即查询并缓存，等待结果后返回（阻塞）
 * */
export async function getGroupInfoAsync(groupId: string): Promise<TGroupCache | undefined> {
	const log = logger.child("GroupInfo");

	if (groupNameCache[groupId]) {
		return groupNameCache[groupId];
	}

	const result = await (pendingQueries.get(groupId) ?? queryGroup(groupId, log));
	return result ?? undefined;
}

/** 核心查询函数，返回 Promise 并统一管理 */
export function queryGroup(groupId: string, log: ILogger): Promise<TGroupCache | null> {
	// 已有进行中的查询，直接复用
	if (pendingQueries.has(groupId)) {
		return pendingQueries.get(groupId)!;
	}

	const promise = getGroup(groupId, log)
		.then((info) => {
			if (!info) throw new Error("HTTP Error");
			const cache: TGroupCache = {
				name: info.data.name,
				introduction: info.data.introduction,
				avatarUrl: info.data.avatarUrl,
				directJoin: info.data.directJoin,
				categoryId: info.data.categoryId,
				categoryName: info.data.categoryName,
				private: info.data.private,
				historyMsg: info.data.historyMsg
			};
			groupNameCache[groupId] = cache;
			return cache;
		})
		.catch((err) => {
			log.warn(`查询群 ${groupId} 名称失败:`, err);
			return null;
		})
		.finally(() => {
			pendingQueries.delete(groupId);
		});

	pendingQueries.set(groupId, promise);
	return promise;
}

const userObjectCache: Record<string, TUser> = {};

export async function getUserObject(userId: string): Promise<TUser | undefined> {
	const log = logger.child("User");
	// 命中缓存，直接返回
	if (userObjectCache[userId]) {
		return userObjectCache[userId];
	}

	const user = await getUser(userId, log);

	if (user) userObjectCache[userId] = user;

	return user;
}
