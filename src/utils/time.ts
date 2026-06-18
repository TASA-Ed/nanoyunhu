export function formatTimestampDiff(start: number, end: number): string {
	// 获取绝对差值
	const diff = Math.abs(end - start);

	// 计算小时、分钟和秒
	const hours = Math.floor(diff / 3600);
	const minutes = Math.floor((diff % 3600) / 60);
	const seconds = diff % 60;

	return `${hours} 时 ${minutes} 分 ${seconds} 秒`;
}
