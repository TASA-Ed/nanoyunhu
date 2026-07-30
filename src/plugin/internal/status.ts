import type { HookContext } from "#/plugin/types.ts";
import type { ILogger } from "#/types.ts";

export async function pluginStatus(ctx: HookContext, log: ILogger): Promise<void> {
	if (ctx.event.msg?.data?.value?.content?.text !== "#nanoyunhu") return;
	const info = ctx.ctx.utils.getSystemInfo();
	const msg = {
		msgId: ctx.ctx.utils.generateMsgID(),
		chatId: ctx.event.msg?.data?.value?.chatId,
		chatType: ctx.event.msg?.data?.value?.chatType,
		contentType: 1,
		data: {
			text: `${ctx.ctx.appName} 信息\n版本: ${ctx.ctx.appVersion}\n平台: ${info.type} ${info.release} (${info.arch})\n运行时间: ${ctx.ctx.utils.formatTimestampDiff(Math.floor(ctx.ctx.startTimestamp.getTime() / 1000), Math.floor(new Date().getTime() / 1000))}`
		}
	};
	const send = await ctx.ctx.protocol.sendMessage(msg, log);
	if (!send) {
		log.warn("Message send failed:", msg);
	}
}
