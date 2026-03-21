import type { FastifyReply } from "fastify";
import type { Logger } from "../../../utils/logger.ts";

/** feature 字符串，格式为 `domain.method`，如 `message.delete` */
export type FeatureString = `${string}.${string}` | `${string}.${string}.${string}`;

/** Satori API 类 */
export interface ISatoriHandler<TBody extends object | undefined = object | undefined> {
	/** 声明该 Handler 实现了哪个特性 */
	readonly feature: FeatureString;
	/** runtime 校验，返回 true 则 body 被收窄为 TBody */
	validate(body: object | undefined): body is TBody;
	register(body: TBody, url: string, rep: FastifyReply, log: Logger): Promise<any>;
}

export type HandlerMap<T extends ISatoriHandler> = {
	[K in T as K["feature"]]: K;
};
