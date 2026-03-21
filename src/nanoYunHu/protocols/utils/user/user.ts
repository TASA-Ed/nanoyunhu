import type { Logger } from "../../../../utils/logger.ts";
import { BASE_URL } from "../../../../types.ts";
import type { User } from "./user_types.ts";
import { request } from "../../../../utils/http.ts";

export async function getUser(id: string, log: Logger): Promise<User | undefined> {
	const response = await request<User>(
		`${BASE_URL.web}user/homepage?userId=${id}`,
		{ method: "GET" },
		global.appConfig.network.httpTimeoutMs,
		log
	);
	if (response.success && response.data.code === 1 && response.data.data.user.registerTime !== 0) {
		log.debug("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}
