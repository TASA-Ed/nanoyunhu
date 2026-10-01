import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, PFriend, PFriendSend } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { Context } from "#/core/context.ts";
import type { ILogger, TChatTypeValues, TWebRequestBase } from "#/types.ts";
import type { request } from "#/utils/http.ts";
import { approveRequest, deleteFriend, getAddressBookList } from "#/nano_yunhu/protocols/utils/friend/friend.ts";
import { binaryBody, makeContext, makeLogger, success, transportFailures } from "./fixtures.ts";

const http = vi.hoisted(() => ({ request: vi.fn<typeof request>() }));
vi.mock("#/utils/http.ts", () => ({ request: http.request }));

beforeEach((): void => {
	http.request.mockReset();
});

describe("getAddressBookList", (): void => {
	it("requests a full protobuf address book and preserves user, group and bot categories", async (): Promise<void> => {
		const ctx = makeContext();
		const log = makeLogger();
		const data = PFriend.AddressBookList.decode(
			PFriend.AddressBookList.encode({
				status: { code: 1, requestId: 7n, msg: "ok" },
				md5: "server-digest",
				data: [
					{ listName: "用户", chatType: 1, data: [{ chatId: "user-1", remark: "好友备注", name: "原名" }] },
					{ listName: "我加入的群聊", chatType: 2, data: [{ chatId: "group-1", permissionLevel: 100 }] },
					{ listName: "机器人", chatType: 3, data: [{ chatId: "bot-1", noDisturb: true }] }
				]
			})
		);
		http.request.mockResolvedValue(success(data));

		expect(await getAddressBookList(ctx, log)).toEqual(data);
		expect(http.request).toHaveBeenCalledWith(
			`${BASE_URL.v1}friend/address-book-list`,
			{ method: "POST", headers: { token: "account-token" }, body: expect.any(Buffer) },
			log,
			4321,
			PFriend.AddressBookList
		);
		expect(PFriendSend.AddressBookList.decode(binaryBody(http.request.mock.calls[0]?.[1].body))).toEqual({ md5: "" });
	});

	it("accepts an empty successful address book", async (): Promise<void> => {
		const data = PFriend.AddressBookList.decode(PFriend.AddressBookList.encode({ status: { code: 1 }, data: [] }));
		http.request.mockResolvedValue(success(data));
		expect((await getAddressBookList(makeContext(), makeLogger()))?.data).toEqual([]);
	});

	it.each([0, 2])("rejects business status %i even when HTTP succeeds", async (code: number): Promise<void> => {
		const data = PFriend.AddressBookList.decode(PFriend.AddressBookList.encode({ status: { code } }));
		http.request.mockResolvedValue(success(data));
		expect(await getAddressBookList(makeContext(), makeLogger())).toBeUndefined();
	});

	it.each(transportFailures)(
		"returns undefined after $label",
		async ({ response }: (typeof transportFailures)[number]): Promise<void> => {
			http.request.mockResolvedValue(response);
			expect(await getAddressBookList(makeContext(), makeLogger())).toBeUndefined();
		}
	);
});

describe("friend mutation request bodies", (): void => {
	it.each<TChatTypeValues>([1, 2, 3])(
		"serializes deletion of chat type %i",
		async (chatType: TChatTypeValues): Promise<void> => {
			const ctx = makeContext();
			const log = makeLogger();
			http.request.mockResolvedValue(success({ code: 1, msg: "deleted" }));

			expect(await deleteFriend(ctx, '聊天-"id', chatType, log)).toEqual({ code: 1, msg: "deleted" });
			expect(http.request).toHaveBeenCalledWith(
				`${BASE_URL.v1}friend/delete-friend`,
				{ method: "POST", headers: { token: "account-token" }, body: JSON.stringify({ chatId: '聊天-"id', chatType }) },
				log,
				4321
			);
		}
	);

	it.each<1 | 2 | 3 | 4>([1, 2, 3, 4])(
		"serializes approval state %i with the numeric request ID",
		async (agree: 1 | 2 | 3 | 4): Promise<void> => {
			const ctx = makeContext();
			const log = makeLogger();
			http.request.mockResolvedValue(success({ code: 1, msg: "processed" }));

			expect(await approveRequest(ctx, 123456, agree, log)).toEqual({ code: 1, msg: "processed" });
			expect(http.request).toHaveBeenCalledWith(
				`${BASE_URL.v1}friend/agree-apply`,
				{ method: "POST", headers: { token: "account-token" }, body: JSON.stringify({ id: 123456, agree }) },
				log,
				4321
			);
		}
	);
});

const mutations: {
	name: string;
	invoke: (ctx: Context, log: ILogger) => Promise<TWebRequestBase | undefined>;
}[] = [
	{
		name: "deleteFriend",
		invoke: (ctx: Context, log: ILogger): Promise<TWebRequestBase | undefined> => deleteFriend(ctx, "group-1", 2, log)
	},
	{
		name: "approveRequest",
		invoke: (ctx: Context, log: ILogger): Promise<TWebRequestBase | undefined> => approveRequest(ctx, 12, 2, log)
	}
];

describe.each(mutations)("$name error handling", ({ invoke }: (typeof mutations)[number]): void => {
	it("preserves a business failure so the caller can inspect its code and message", async (): Promise<void> => {
		const data: TWebRequestBase = { code: 2, msg: "群主不可退群" };
		http.request.mockResolvedValue(success(data));
		expect(await invoke(makeContext(), makeLogger())).toEqual(data);
	});

	it("preserves a structured HTTP error instead of discarding server details", async (): Promise<void> => {
		const error: TWebRequestBase = { code: 403, msg: "没有权限" };
		http.request.mockResolvedValue({ success: false, kind: "http", code: 403, error, mimeType: "application/json" });
		expect(await invoke(makeContext(), makeLogger())).toEqual(error);
	});

	it.each(transportFailures)(
		"does not expose a $label as a business result",
		async ({ response }: (typeof transportFailures)[number]): Promise<void> => {
			http.request.mockResolvedValue(response);
			expect(await invoke(makeContext(), makeLogger())).toBeUndefined();
		}
	);
});
