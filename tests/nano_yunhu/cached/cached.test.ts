import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "#/core/context.ts";
import type { ILogger } from "#/types.ts";
import type { TGroupCache } from "#/nano_yunhu/protocols/utils/group/group_types.ts";
import type { TUser } from "#/nano_yunhu/protocols/utils/user/user_types.ts";
import type * as CachedModule from "#/nano_yunhu/cached/cached.ts";
import type { InferProtoModel } from "@saltify/typeproto";
import type { PGroup } from "@nanoyunhu/yunhu-protobuf-typeproto";

type GroupResponse = InferProtoModel<typeof PGroup.GroupInfo>;
let cached: typeof CachedModule;
const getGroup = vi.fn<Context["protocol"]["getGroup"]>();
const getUser = vi.fn<Context["protocol"]["getUser"]>();
const ctx = { protocol: { getGroup, getUser } } as unknown as Context;
const log: ILogger = {
	trace: vi.fn(),
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	child: vi.fn<ILogger["child"]>(),
	level: "info"
};
const group: TGroupCache = {
	name: "测试群",
	introduction: "介绍",
	avatarUrl: "https://example.invalid/avatar",
	directJoin: true,
	categoryId: 42n,
	categoryName: "分类",
	private: false,
	historyMsg: true,
	hideGroupMembers: false
};
const user: TUser = {
	code: 1,
	msg: "ok",
	data: {
		user: {
			userId: "user-1",
			nickname: "用户",
			avatarUrl: "avatar",
			registerTime: 10,
			registerTimeText: "time",
			onLineDay: 2,
			continuousOnLineDay: 1,
			medals: [],
			isVip: 0
		}
	}
};

beforeEach(async (): Promise<void> => {
	vi.resetModules();
	vi.clearAllMocks();
	getGroup.mockReset();
	getUser.mockReset();
	// Reloading is required to isolate the module-private caches between test cases.
	cached = await import("#/nano_yunhu/cached/cached.ts");
});

describe("group cache", (): void => {
	it("returns the ID immediately and shares the background query with blocking callers", async (): Promise<void> => {
		const { promise, resolve } = Promise.withResolvers<GroupResponse | undefined>();
		getGroup.mockReturnValue(promise);
		expect(cached.getGroupName(ctx, "group-1")).toBe("group-1");
		expect(cached.getGroupName(ctx, "group-1")).toBe("group-1");
		const pending = cached.getGroupInfoAsync(ctx, "group-1");
		const query = cached.queryGroup(ctx, "group-1", log);
		expect(cached.queryGroup(ctx, "group-1", log)).toBe(query);
		expect(getGroup).toHaveBeenCalledTimes(1);
		resolve({ data: group } as GroupResponse);
		expect(await pending).toEqual(group);
		expect(await query).toEqual(group);
		expect(cached.getGroupName(ctx, "group-1")).toBe(group.name);
		expect(await cached.getGroupInfoAsync(ctx, "group-1")).toBe(await pending);
		expect(getGroup).toHaveBeenCalledTimes(1);
	});

	it.each(["missing", "rejected"] as const)(
		"clears a %s query so the group can be retried",
		async (failure): Promise<void> => {
			if (failure === "missing") getGroup.mockResolvedValueOnce(undefined);
			else getGroup.mockRejectedValueOnce(new Error("offline"));
			expect(await cached.queryGroup(ctx, "group-1", log)).toBeNull();
			expect(log.warn).toHaveBeenCalledTimes(1);
			getGroup.mockResolvedValueOnce({ data: group } as GroupResponse);
			expect(await cached.getGroupInfoAsync(ctx, "group-1")).toEqual(group);
			expect(getGroup).toHaveBeenCalledTimes(2);
		}
	);

	it("returns undefined for a failed blocking lookup without poisoning another group", async (): Promise<void> => {
		getGroup.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ data: group } as GroupResponse);
		expect(await cached.getGroupInfoAsync(ctx, "missing")).toBeUndefined();
		expect(await cached.getGroupInfoAsync(ctx, "other")).toEqual(group);
		expect(cached.getGroupName(ctx, "other")).toBe(group.name);
	});
});

describe("user cache", (): void => {
	it("caches successful users by ID without sharing entries between IDs", async (): Promise<void> => {
		const other: TUser = { ...user, data: { user: { ...user.data.user, userId: "user-2", nickname: "另一个用户" } } };
		getUser.mockResolvedValueOnce(user).mockResolvedValueOnce(other);
		expect(await cached.getUserObject(ctx, "user-1")).toBe(user);
		expect(await cached.getUserObject(ctx, "user-1")).toBe(user);
		expect(await cached.getUserObject(ctx, "user-2")).toBe(other);
		expect(getUser).toHaveBeenCalledTimes(2);
	});

	it("does not cache missing users", async (): Promise<void> => {
		getUser.mockResolvedValueOnce(undefined).mockResolvedValueOnce(user);
		expect(await cached.getUserObject(ctx, "user-1")).toBeUndefined();
		expect(await cached.getUserObject(ctx, "user-1")).toBe(user);
		expect(await cached.getUserObject(ctx, "user-1")).toBe(user);
		expect(getUser).toHaveBeenCalledTimes(2);
	});

	it("propagates a rejected lookup and allows a subsequent successful lookup", async (): Promise<void> => {
		const error = new Error("offline");
		getUser.mockRejectedValueOnce(error).mockResolvedValueOnce(user);
		await expect(cached.getUserObject(ctx, "user-1")).rejects.toBe(error);
		expect(await cached.getUserObject(ctx, "user-1")).toBe(user);
		expect(getUser).toHaveBeenCalledTimes(2);
	});
});
