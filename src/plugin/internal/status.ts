import { getSystemInfo } from "#/utils/device.ts";
import { generateMsgID } from "#/utils/generate.ts";
import { formatTimestampDiff } from "#/utils/time.ts";
import { sendMessage } from "#/nano_yunhu/protocols/utils/message/message.ts";
import type { HookContext } from "#/plugin/types.ts";
import type { ILogger } from "#/types.ts";

export async function pluginStatus(ctx: HookContext, log: ILogger): Promise<void> {
	if (ctx.event.msg?.data?.value?.content?.text !== "#nanoyunhu") return;
	const info = getSystemInfo();
	const msg = {
		msgId: generateMsgID(),
		chatId: ctx.event.msg?.data?.value?.chatId,
		chatType: ctx.event.msg?.data?.value?.chatType,
		contentType: 1,
		data: {
			text: `${ctx.ctx.appName} 信息\n版本: ${ctx.ctx.appVersion}\n平台: ${info.type} ${info.release} (${info.arch})\n运行时间: ${formatTimestampDiff(Math.floor(ctx.ctx.startTimestamp.getTime() / 1000), Math.floor(new Date().getTime() / 1000))}`
		}
	};
	const send = await sendMessage(ctx.ctx, msg, log);
	if (!send) {
		log.warn("Message send failed:", msg);
	}
}
