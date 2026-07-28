import { request } from "#/utils/http.ts";
import { BASE_URL, type ILogger } from "#/types.ts";
import { PMsgSend, PV1 } from "@nanoyunhu/yunhu-protobuf-typeproto";
import type { InferProtoModel, InferProtoModelInput } from "@saltify/typeproto";
import type { Context } from "#/core/context.ts";

export async function sendMessage(
	ctx: Context,
	send: InferProtoModelInput<typeof PMsgSend.SendMsg>,
	log: ILogger
): Promise<InferProtoModel<typeof PV1.Base> | undefined> {
	const buffer = PMsgSend.SendMsg.encode(send);

	const response = await request<typeof PV1.Base, InferProtoModel<typeof PV1.Base>>(
		`${BASE_URL.v1}msg/send-message`,
		{ method: "POST", headers: { token: ctx.accountData.token }, body: Buffer.from(buffer) },
		log,
		ctx.appConfig.network.httpTimeoutMs,
		PV1.Base
	);
	if (response.success && response.data.status.code === 1) {
		log.trace("Data:", response.data);
		return response.data;
	}
	if (response.success) log.debug("Failed:", response.data);
	else log.debug("Failed:", response.error);
	return undefined;
}
