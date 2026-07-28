import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { persistConfig } from "#/core/config.ts";
import { Logger } from "#/utils/logger.ts";
import type { Context } from "#/core/context.ts";

const ALGORITHM = "aes-256-ecb" as const;

/**
 * 加密 token
 * @param token {string} Token
 * @param device {string} 设备名
 * @throws RangeError 可能内存不足
 * @returns 例：[crypto:(aes)|iv:(b64=)]
 */
export function encryptToken(token: string, device: string): string {
	const salt = randomBytes(16);
	const key = scryptSync(device, salt, 32, { cost: 1024, blockSize: 4 });

	const cipher = createCipheriv(ALGORITHM, key, null);

	let encrypted = cipher.update(token, "utf8", "hex");
	encrypted += cipher.final("hex");

	return `[crypto:(${encrypted})|salt:(${salt.toString("base64")})]`;
}

/**
 * 解密 token
 * @param ctx {Context} APP 上下文
 * @param encryptedToken {string} 已加密的 Token
 * @param device {string} 设备名
 * @throws RangeError 可能内存不足
 * @throws Error 加密失败
 */
export function decryptToken(ctx: Context, encryptedToken: string, device: string): string {
	if (!encryptedToken.startsWith("[crypto:(") && !encryptedToken.endsWith(")]")) {
		const account = ctx.appConfig.account ?? (ctx.appConfig.account = {});
		account.token = encryptToken(encryptedToken, device);
		ctx.appConfig.account = account;
		persistConfig(ctx, new Logger({ prefix: "TokenCrypto" }));
		return encryptedToken;
	}

	const text = encryptedToken.slice(1, -1).split("|");

	if (text.length !== 2) throw new Error(`Bad encrypted token: ${encryptedToken}`);
	const key = scryptSync(device, Buffer.from(text[1].slice(6, -1), "base64"), 32, { cost: 1024, blockSize: 4 });

	const decipher = createDecipheriv(ALGORITHM, key, null);

	let decrypted = decipher.update(text[0].slice(8, -1), "hex", "utf8");
	decrypted += decipher.final("utf8");

	return decrypted;
}
