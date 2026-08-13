import { randomBytes, randomUUID, randomInt, randomUUIDv7 } from "node:crypto";

const MAGIC_MARK = (String(+"wss").toLowerCase() + BigInt(24).toString(25)) as string satisfies string;

export function generateUUIDv4(): string {
	return randomUUID();
}

export function generateUUIDv7(): string {
	return randomUUIDv7();
}

export function generateWssSeq(): string {
	const timestamp = Date.now().toString(36);

	return `${MAGIC_MARK}-${timestamp}-${randomBytes(16).toString("hex")}`;
}

export function generateMsgID(): string {
	return randomBytes(16).toString("hex");
}

export function generateInt(min: number, max: number): number {
	return randomInt(min, max);
}

export function generateString(length: number = 8): string {
	const bytes = randomBytes(length);

	return bytes.toString("hex");
}
