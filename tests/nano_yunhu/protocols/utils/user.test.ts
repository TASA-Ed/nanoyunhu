import { beforeEach, describe, expect, it, vi } from "vitest";
import { BASE_URL } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { request } from "#/utils/http.ts";
import type { TUser } from "#/nano_yunhu/protocols/utils/user/user_types.ts";
import { getUser } from "#/nano_yunhu/protocols/utils/user/user.ts";
import { makeContext, makeLogger, success, transportFailures } from "./fixtures.ts";

const http = vi.hoisted(() => ({ request: vi.fn<typeof request>() }));
vi.mock("#/utils/http.ts", () => ({ request: http.request }));

const user: TUser = {
	code: 1,
	msg: "ok",
	data: {
		user: {
			userId: "user-42",
			nickname: "测试用户",
			avatarUrl: "https://example.invalid/avatar",
			registerTime: 1700000000,
			registerTimeText: "2023-11-14",
			onLineDay: 12,
			continuousOnLineDay: 3,
			medals: [{ id: 1, name: "勋章", desc: "说明", imageUrl: "medal.png", sort: 2 }],
			isVip: 1
		}
	}
};

beforeEach((): void => {
	http.request.mockReset();
});

describe("getUser", (): void => {
	it.each([1, 1700000000])(
		"accepts registered users at timestamp %i and preserves profile details",
		async (registerTime: number): Promise<void> => {
			const ctx = makeContext();
			const log = makeLogger();
			const data: TUser = { ...user, data: { user: { ...user.data.user, registerTime } } };
			http.request.mockResolvedValue(success(data));

			expect(await getUser(ctx, "user-42", log)).toEqual(data);
			expect(http.request).toHaveBeenCalledWith(
				`${BASE_URL.web}user/homepage?userId=user-42`,
				{ method: "GET" },
				log,
				4321
			);
		}
	);

	it("rejects the zero-registration placeholder even with success code 1", async (): Promise<void> => {
		const data: TUser = { ...user, data: { user: { ...user.data.user, registerTime: 0 } } };
		http.request.mockResolvedValue(success(data));
		expect(await getUser(makeContext(), "missing", makeLogger())).toBeUndefined();
	});

	it.each([0, 2])("rejects business code %i even for a registered profile", async (code: number): Promise<void> => {
		http.request.mockResolvedValue(success({ ...user, code }));
		expect(await getUser(makeContext(), "user-42", makeLogger())).toBeUndefined();
	});

	it.each(transportFailures)(
		"returns undefined after $label",
		async ({ response }: (typeof transportFailures)[number]): Promise<void> => {
			http.request.mockResolvedValue(response);
			expect(await getUser(makeContext(), "user-42", makeLogger())).toBeUndefined();
		}
	);
});
