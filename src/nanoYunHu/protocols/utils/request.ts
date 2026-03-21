import { randomBytes } from "node:crypto";

export function generateRequestID(): string {
	const bytes = randomBytes(16);

	// 设置 version (第 6 字节高 4 位为 0100)
	bytes[6] = (bytes[6] & 0x0f) | 0x40;

	// 设置 variant (第 8 字节高 2 位为 10)
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = bytes.toString("hex");

	return (
		hex.slice(0, 8) + "-" +
		hex.slice(8, 12) + "-" +
		hex.slice(12, 16) + "-" +
		hex.slice(16, 20) + "-" +
		hex.slice(20)
	);
}
