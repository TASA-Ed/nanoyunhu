import { randomBytes } from "node:crypto";

export function generateRequestID(): string {
	return randomBytes(Math.ceil(64 / 2))
		.toString("hex")
		.slice(0, 32);
}
