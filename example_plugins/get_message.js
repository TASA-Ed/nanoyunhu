/**
 * 示例插件
 *
 * 使用 #取 来获取消息体
 */

export const name = "GetMessage";
export const hookNameList = ["preMessage"];

export async function preMessage(ctx, log) {
	if (ctx.event.msg?.data?.value?.content?.text !== "#取") return;
	if (!ctx.event.msg?.data?.value?.quoteMsgId) {
		const msg = {
			msgId: ctx.ctx.utils.generateMsgID(),
			chatId: ctx.event.msg?.data?.value?.chatId,
			chatType: ctx.event.msg?.data?.value?.chatType,
			contentType: 1,
			data: {
				text: `请引用一个消息`
			}
		};
		const send = await ctx.ctx.protocol.sendMessage(msg, log);
		if (!send) {
			log.warn("Message send failed:", msg);
		}
		return;
	}
	const get = await ctx.ctx.protocol.getMessageById(
		ctx.event.msg?.data?.value?.quoteMsgId,
		ctx.event.msg?.data?.value?.chatType,
		ctx.event.msg?.data?.value?.chatId,
		log
	);
	if (!get) {
		log.warn("Message get failed");
		const msg = {
			msgId: ctx.ctx.utils.generateMsgID(),
			chatId: ctx.event.msg?.data?.value?.chatId,
			chatType: ctx.event.msg?.data?.value?.chatType,
			contentType: 1,
			data: {
				text: `获取失败`
			}
		};
		const send = await ctx.ctx.protocol.sendMessage(msg, log);
		if (!send) {
			log.warn("Message send failed:", msg);
		}
		return;
	}
	const msg = {
		msgId: ctx.ctx.utils.generateMsgID(),
		chatId: ctx.event.msg?.data?.value?.chatId,
		chatType: ctx.event.msg?.data?.value?.chatType,
		contentType: 3,
		data: {
			text: `<details>
${JSON.stringify(
	get,
	(_key, value) => {
		return typeof value === "bigint" ? String(value) : value;
	},
	2
)}
</details>`
		}
	};
	const send = await ctx.ctx.protocol.sendMessage(msg, log);
	if (!send) {
		log.warn("Message send failed:", msg);
	}
}
