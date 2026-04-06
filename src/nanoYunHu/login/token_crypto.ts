import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { persistConfig } from "../../config.ts";
import { Logger } from "../../utils/logger.ts";

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
 * @param encryptedToken {string} 已加密的 Token
 * @param device {string} 设备名
 * @throws RangeError 可能内存不足
 * @throws Error 加密失败
 */
export function decryptToken(encryptedToken: string, device: string): string {
	if (!encryptedToken.startsWith("[crypto:(") && !encryptedToken.endsWith(")]")) {
		const account = global.appConfig.account ?? (global.appConfig.account = {});
		account.token = encryptToken(encryptedToken, device);
		global.appConfig.account = account;
		persistConfig(new Logger({ prefix: "TokenCrypto" }));
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
