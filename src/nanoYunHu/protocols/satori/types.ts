import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../utils/logger.ts";

// ─── Feature 类型 ───────────────────────────────────────────────────────────

/** feature 字符串，格式为 `domain.method`，如 `message.delete` */
export type FeatureString = `${string}.${string}` | `${string}.${string}.${string}`;

// ─── 核心接口 ───────────────────────────────────────────────────────────────

export interface ISatoriFeatureHandler {
	/** 声明该 Handler 实现了哪些特性 */
	readonly features: FeatureString[];

	// 可选方法——实现哪些就覆盖哪些
	get?(server: FastifyInstance, logger: Logger): Promise<void>;
	set?(server: FastifyInstance, logger: Logger): Promise<void>;
	unset?(server: FastifyInstance, logger: Logger): Promise<void>;
	list?(server: FastifyInstance, logger: Logger): Promise<void>;
	create?(server: FastifyInstance, logger: Logger): Promise<void>;
	update?(server: FastifyInstance, logger: Logger): Promise<void>;
	delete?(server: FastifyInstance, logger: Logger): Promise<void>;
	kick?(server: FastifyInstance, logger: Logger): Promise<void>;
	mute?(server: FastifyInstance, logger: Logger): Promise<void>;
	approve?(server: FastifyInstance, logger: Logger): Promise<void>;
	clear?(server: FastifyInstance, logger: Logger): Promise<void>;
}
