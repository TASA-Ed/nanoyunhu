import { createHash } from "node:crypto";
import { networkInterfaces, hostname, cpus, platform, arch } from "node:os";

function getMacAddresses(): string {
	const nets = networkInterfaces();
	const macs: string[] = [];

	for (const iface of Object.values(nets)) {
		if (!iface) continue;
		for (const info of iface) {
			// 排除本地回环与虚拟网卡
			if (!info.internal && info.mac && info.mac !== "00:00:00:00:00:00") {
				macs.push(info.mac.toLowerCase());
			}
		}
	}

	return macs.sort().join("|");
}

function getCpuInfo(): string {
	const list = cpus();
	if (list.length === 0) return "unknown-cpu";
	const { model, speed } = list[0];
	return `${model}-${speed}-${list.length}`;
}

function getTime(): string {
	return Date.now().toString();
}

const CHARSET = "abcdefghijklmnopqrstuvwxyz0123456789"; // 36 字符

/**
 * 将任意长度的 Buffer（哈希字节）映射到指定字符集的 N 位字符串。
 * 使用大数取模，分布均匀。
 */
function bufferToId(buf: Buffer, length: number = 10): string {
	// 把 32 字节哈希当作大整数，逐步取模
	let result = "";
	// 复制一份用于运算
	const bytes = Array.from(buf);

	for (let i = 0; i < length; i++) {
		// 对整个大数数组取模 36
		let remainder = 0;
		for (let j = 0; j < bytes.length; j++) {
			const val = remainder * 256 + bytes[j];
			bytes[j] = Math.floor(val / CHARSET.length);
			remainder = val % CHARSET.length;
		}
		result = CHARSET[remainder] + result;
	}

	return result;
}

/**
 * 获取本机唯一设备 ID（10 位小写字母+数字）。
 */
export function generateDeviceId(): string {
	const fingerprint = [
		getMacAddresses(),
		getCpuInfo(),
		getTime(),
		hostname(),
		platform(),
		arch(),
	]
		.filter(Boolean)
		.join("::");

	const hash = createHash("sha256").update(fingerprint).digest();
	return bufferToId(hash);
}
