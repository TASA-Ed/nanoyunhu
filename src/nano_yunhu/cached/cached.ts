import { getGroup } from "../protocols/utils/group/group.ts";
import { Logger } from "../../utils/logger.ts";
import { TUser } from "../protocols/utils/user/user_types.ts";
import { getUser } from "../protocols/utils/user/user.ts";

const logger = new Logger({ prefix: "Cached" });

const groupNameCache: Record<string, string> = {};
const pendingQueries = new Set<string>(); // 防止重复发起查询

export function getGroupName(groupId: string): string {
	const log = logger.child("Group");
	// 命中缓存，直接返回
	if (groupNameCache[groupId]) {
		return groupNameCache[groupId];
	}

	// 后台启动查询任务
	if (!pendingQueries.has(`Group:${groupId}`)) {
		pendingQueries.add(`Group:${groupId}`);

		getGroup(groupId, log)
			.then((name) => {
				if (name) groupNameCache[groupId] = name?.data?.name;
				else throw new Error(`HTTP Error`);
			})
			.catch((err) => {
				log.warn(`查询群 ${groupId} 名称失败:`, err);
			})
			.finally(() => {
				pendingQueries.delete(`Group:${groupId}`);
			});
	}

	// 未命中时暂时返回群号本身
	return groupId;
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
