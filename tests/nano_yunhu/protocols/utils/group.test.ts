import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, PGroup, PGroupSend, PV1 } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel } from "@saltify/typeproto";
import type { Context } from "#/core/context.ts";
import type { ILogger, TWebRequestBase } from "#/types.ts";
import type { request } from "#/utils/http.ts";
import type { getGroupInfoAsync } from "#/nano_yunhu/cached/cached.ts";
import type { TGroupCache } from "#/nano_yunhu/protocols/utils/group/group_types.ts";
import type { TMessageTypeValues } from "#/nano_yunhu/message/message.ts";
import {
	dismissGroup,
	editGroup,
	getGroup,
	quitGroup,
	setGroupMsgTypeLimit
} from "#/nano_yunhu/protocols/utils/group/group.ts";
import { binaryBody, makeContext, makeLogger, success, transportFailures } from "./fixtures.ts";

const dependencies = vi.hoisted(() => ({
	request: vi.fn<typeof request>(),
	getGroupInfoAsync: vi.fn<typeof getGroupInfoAsync>()
}));
vi.mock("#/utils/http.ts", () => ({ request: dependencies.request }));
vi.mock("#/nano_yunhu/cached/cached.ts", () => ({ getGroupInfoAsync: dependencies.getGroupInfoAsync }));

const original: TGroupCache = {
	name: "原群名",
	introduction: "原介绍",
	avatarUrl: "https://example.invalid/avatar",
	directJoin: true,
	historyMsg: true,
	categoryName: "原分类",
	categoryId: 9007199254740993n,
	private: true,
	hideGroupMembers: true
};

function baseResponse(code: number = 1): InferProtoModel<typeof PV1.Base> {
	return PV1.Base.decode(PV1.Base.encode({ status: { code, requestId: 10n, msg: code === 1 ? "ok" : "denied" } }));
}

beforeEach((): void => {
	dependencies.request.mockReset();
	dependencies.getGroupInfoAsync.mockReset();
	dependencies.getGroupInfoAsync.mockResolvedValue({ ...original });
});

describe("getGroup", (): void => {
	it("encodes the group ID and preserves decoded bigint and privacy fields", async (): Promise<void> => {
		const ctx = makeContext();
		const log = makeLogger();
		const data = PGroup.GroupInfo.decode(
			PGroup.GroupInfo.encode({
				status: { code: 1 },
				data: { groupId: "group-1", ...original, headcount: 123n, admin: ["admin-1"] }
			})
		);
		dependencies.request.mockResolvedValue(success(data));

		expect(await getGroup(ctx, "group-1", log)).toEqual(data);
		expect(dependencies.request).toHaveBeenCalledWith(
			`${BASE_URL.v1}group/info`,
			{ method: "POST", headers: { token: "account-token" }, body: expect.any(Buffer) },
			log,
			4321,
			PGroup.GroupInfo
		);
		expect(PGroupSend.GroupInfo.decode(binaryBody(dependencies.request.mock.calls[0]?.[1].body))).toEqual({
			groupId: "group-1"
		});
	});

	it.each([0, 2])("rejects business status %i", async (code: number): Promise<void> => {
		const data = PGroup.GroupInfo.decode(PGroup.GroupInfo.encode({ status: { code } }));
		dependencies.request.mockResolvedValue(success(data));
		expect(await getGroup(makeContext(), "group-1", makeLogger())).toBeUndefined();
	});

	it.each(transportFailures)(
		"returns undefined after $label",
		async ({ response }: (typeof transportFailures)[number]): Promise<void> => {
			dependencies.request.mockResolvedValue(response);
			expect(await getGroup(makeContext(), "group-1", makeLogger())).toBeUndefined();
		}
	);
});

describe("setGroupMsgTypeLimit", (): void => {
	it.each<{ types: TMessageTypeValues[]; encoded: string }>([
		{ types: [1, 3, 14], encoded: "1,3,14" },
		{ types: [2], encoded: "2" },
		{ types: [], encoded: "" }
	])(
		"serializes message restrictions as '$encoded'",
		async ({ types, encoded }: { types: TMessageTypeValues[]; encoded: string }): Promise<void> => {
			const ctx = makeContext();
			const log = makeLogger();
			dependencies.request.mockResolvedValue(success({ code: 1, msg: "updated" }));

			expect(await setGroupMsgTypeLimit(ctx, "group-1", types, log)).toBe(true);
			expect(dependencies.request).toHaveBeenCalledWith(
				`${BASE_URL.v1}group/msg-type-limit`,
				{
					method: "POST",
					headers: { token: "account-token" },
					body: JSON.stringify({ groupId: "group-1", type: encoded })
				},
				log,
				4321
			);
		}
	);

	it.each([0, 2])("does not treat business code %i as success", async (code: number): Promise<void> => {
		dependencies.request.mockResolvedValue(success({ code, msg: "denied" }));
		expect(await setGroupMsgTypeLimit(makeContext(), "group-1", [1], makeLogger())).toBe(false);
	});
});

describe("dismissGroup", (): void => {
	it("sends a protobuf group ID and requires a successful protobuf status", async (): Promise<void> => {
		const ctx = makeContext();
		const log = makeLogger();
		dependencies.request.mockResolvedValue(success(baseResponse()));

		expect(await dismissGroup(ctx, "group-1", log)).toBe(true);
		expect(dependencies.request).toHaveBeenCalledWith(
			`${BASE_URL.v1}group/dismiss-group`,
			{ method: "POST", headers: { token: "account-token" }, body: expect.any(Buffer) },
			log,
			4321,
			PV1.Base
		);
		expect(PGroupSend.GroupInfo.decode(binaryBody(dependencies.request.mock.calls[0]?.[1].body))).toEqual({
			groupId: "group-1"
		});
	});

	it.each([0, 2])("does not treat status %i as success", async (code: number): Promise<void> => {
		dependencies.request.mockResolvedValue(success(baseResponse(code)));
		expect(await dismissGroup(makeContext(), "group-1", makeLogger())).toBe(false);
	});
});

describe("editGroup", (): void => {
	it("merges partial edits with cached fields without losing bigint precision or mutating the cache", async (): Promise<void> => {
		const ctx = makeContext();
		const log = makeLogger();
		const cached = { ...original };
		const edits: Partial<TGroupCache> = {
			name: "新群名",
			introduction: "",
			directJoin: false,
			private: false,
			hideGroupMembers: false
		};
		dependencies.getGroupInfoAsync.mockResolvedValue(cached);
		dependencies.request.mockResolvedValue(success(baseResponse()));

		expect(await editGroup(ctx, "group-1", edits, log)).toBe(true);
		expect(dependencies.request).toHaveBeenCalledWith(
			`${BASE_URL.v1}group/edit-group`,
			{ method: "POST", headers: { token: "account-token" }, body: expect.any(Buffer) },
			log,
			4321,
			PV1.Base
		);
		expect(PGroupSend.EditGroup.decode(binaryBody(dependencies.request.mock.calls[0]?.[1].body))).toEqual({
			groupId: "group-1",
			...original,
			...edits
		});
		expect(cached).toEqual(original);
	});

	it("does not send an incomplete edit when the original group is unavailable", async (): Promise<void> => {
		dependencies.getGroupInfoAsync.mockResolvedValue(undefined);
		expect(await editGroup(makeContext(), "missing", { name: "new" }, makeLogger())).toBe(false);
		expect(dependencies.request).not.toHaveBeenCalled();
	});

	it.each([0, 2])("does not treat status %i as success", async (code: number): Promise<void> => {
		dependencies.request.mockResolvedValue(success(baseResponse(code)));
		expect(await editGroup(makeContext(), "group-1", {}, makeLogger())).toBe(false);
	});
});

const groupMutations: { name: string; invoke: (ctx: Context, log: ILogger) => Promise<boolean> }[] = [
	{
		name: "setGroupMsgTypeLimit",
		invoke: (ctx: Context, log: ILogger): Promise<boolean> => setGroupMsgTypeLimit(ctx, "group-1", [1], log)
	},
	{ name: "dismissGroup", invoke: (ctx: Context, log: ILogger): Promise<boolean> => dismissGroup(ctx, "group-1", log) },
	{
		name: "editGroup",
		invoke: (ctx: Context, log: ILogger): Promise<boolean> => editGroup(ctx, "group-1", { name: "new" }, log)
	}
];

describe.each(groupMutations)("$name transport failures", ({ invoke }: (typeof groupMutations)[number]): void => {
	it.each(transportFailures)(
		"returns false after $label",
		async ({ response }: (typeof transportFailures)[number]): Promise<void> => {
			dependencies.request.mockResolvedValue(response);
			expect(await invoke(makeContext(), makeLogger())).toBe(false);
		}
	);
});

describe("quitGroup", (): void => {
	it("leaves an ordinary group without dismissing it", async (): Promise<void> => {
		const deleteFriend = vi.fn<Context["protocol"]["deleteFriend"]>().mockResolvedValue({ code: 1, msg: "ok" });
		const dismiss = vi.fn<Context["protocol"]["dismissGroup"]>();
		const log = makeLogger();
		expect(await quitGroup(makeContext({ deleteFriend, dismissGroup: dismiss }), "group-1", log)).toBe(true);
		expect(deleteFriend).toHaveBeenCalledWith("group-1", 2, log);
		expect(dismiss).not.toHaveBeenCalled();
	});

	it.each([true, false])(
		"returns dismissal result %s when the server says the owner cannot leave",
		async (dismissed: boolean): Promise<void> => {
			const deleteFriend = vi
				.fn<Context["protocol"]["deleteFriend"]>()
				.mockResolvedValue({ code: 2, msg: "操作失败：群主不可退群，请解散群聊" });
			const dismiss = vi.fn<Context["protocol"]["dismissGroup"]>().mockResolvedValue(dismissed);
			const log = makeLogger();
			expect(await quitGroup(makeContext({ deleteFriend, dismissGroup: dismiss }), "group-1", log)).toBe(dismissed);
			expect(dismiss).toHaveBeenCalledWith("group-1", log);
			expect(dismiss).toHaveBeenCalledTimes(1);
		}
	);

	it("does not dismiss a successfully left group even if the response text mentions owner restrictions", async (): Promise<void> => {
		const deleteFriend = vi
			.fn<Context["protocol"]["deleteFriend"]>()
			.mockResolvedValue({ code: 1, msg: "群主不可退群" });
		const dismiss = vi.fn<Context["protocol"]["dismissGroup"]>();
		expect(await quitGroup(makeContext({ deleteFriend, dismissGroup: dismiss }), "group-1", makeLogger())).toBe(true);
		expect(dismiss).not.toHaveBeenCalled();
	});

	it.each<{ label: string; result: TWebRequestBase | undefined }>([
		{ label: "missing result", result: undefined },
		{ label: "unrelated business failure", result: { code: 2, msg: "没有权限" } },
		{ label: "empty error message", result: { code: 0, msg: "" } }
	])(
		"does not dismiss the group after $label",
		async ({ result }: { label: string; result: TWebRequestBase | undefined }): Promise<void> => {
			const deleteFriend = vi.fn<Context["protocol"]["deleteFriend"]>().mockResolvedValue(result);
			const dismiss = vi.fn<Context["protocol"]["dismissGroup"]>();
			expect(await quitGroup(makeContext({ deleteFriend, dismissGroup: dismiss }), "group-1", makeLogger())).toBe(
				false
			);
			expect(dismiss).not.toHaveBeenCalled();
		}
	);
});
