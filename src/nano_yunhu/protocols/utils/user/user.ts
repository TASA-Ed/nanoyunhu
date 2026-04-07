import type { ILogger } from "../../../../types.ts";
import { BASE_URL, TV1RequestFailed } from "../../../../types.ts";
import type { TUser } from "./user_types.ts";
import { request } from "../../../../utils/http.ts";

export async function getUser(id: string, log: ILogger): Promise<TUser | undefined> {
	const response = await request<TUser, TV1RequestFailed>(
		`${BASE_URL.web}user/homepage?userId=${id}`,
		{ method: "GET" },
		global.appConfig.network.httpTimeoutMs,
		log
	);
	if (response.success && response.data.code === 1 && response.data.data.user.registerTime !== 0) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}
