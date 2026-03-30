import { getGroup } from "../protocols/utils/group/group.ts";
import { Logger } from "../../utils/logger.ts";

const logger = new Logger({ prefix: "Cached" });

const groupNameCache: Record<string, string> = {};
const pendingQueries = new Set<string>(); // 防止重复发起查询

export function getGroupName(groupId: string): string {
	const log = logger.child("Group");
	// 命中缓存，直接返回
	if (groupNameCache[groupId]) {
		return groupNameCache[groupId];
	}

	// 后台启动查询任务（防止重复）
	if (!pendingQueries.has(groupId)) {
		pendingQueries.add(groupId);

		getGroup(groupId, log)
			.then((name) => {
				if (name) groupNameCache[groupId] = name?.data?.name;
				else throw new Error(`HTTP Error`);
			})
			.catch((err) => {
				log.warn(`查询群 ${groupId} 名称失败:`, err);
			})
			.finally(() => {
				pendingQueries.delete(groupId);
			});
	}

	// 未命中时暂时返回群号本身
	return groupId;
}
