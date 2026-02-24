import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Colors, SelectChoices } from '../types.js';

/**
 * 在命令行中向用户显示提示并等待文字输入。
 *
 * @param question  显示给用户的提示语
 * @param options   可选配置
 * @param options.defaultValue  用户直接回车时使用的默认值
 * @param options.validate      自定义校验函数，返回错误信息字符串表示不合法，返回 undefined 表示通过
 * @returns 用户输入的字符串（已 trim）
 *
 * @example
 * const name = await prompt("请输入你的名字");
 * const age  = await prompt("请输入年龄", { defaultValue: "18" });
 */
export async function prompt(
	question: string,
	options?: {
		defaultValue?: string;
		validate?: (value: string) => string | undefined;
	}
): Promise<string> {
	const rl = readline.createInterface({ input, output });

	const hint = options?.defaultValue
		? ` ${Colors.dim}(默认: ${options.defaultValue})${Colors.reset}`
		: "";

	let answer: string;

	while (true) {
		let raw: string;
		try {
			raw = await rl.question(`${Colors.cyan}?${Colors.reset} ${Colors.bold}${question}${Colors.reset}${hint} ${Colors.green}›${Colors.reset} `);
		} catch {
			rl.close();
			output.write("\n");
			process.exit(130);
		}
		answer = raw.trim() || (options?.defaultValue ?? "");

		if (options?.validate) {
			const error = options.validate(answer);
			if (error) {
				output.write(`  ${Colors.yellow}⚠ ${error}${Colors.reset}\n`);
				continue;
			}
		}

		break;
	}

	rl.close();
	return answer;
}

/**
 * 在命令行中向用户显示选项列表并等待单选。
 * 使用方向键（↑ / ↓）移动光标，按 Enter 确认。
 *
 * @param question  显示给用户的提示语
 * @param choices   选项列表（字符串数组，或包含 label / value 的对象数组）
 * @returns 被选中选项的值（字符串或原始 value）
 *
 * @example
 * const Colors = await select("请选择颜色", ["红", "绿", "蓝"]);
 *
 * const env = await select("请选择环境", [
 *   { label: "开发环境", value: "dev" },
 *   { label: "生产环境", value: "prod" },
 * ]);
 */
export async function select(
	question: string,
	choices: SelectChoices
): Promise<string> {
	const items: SelectChoices = choices;

	if (items.length === 0) throw new Error("choices 不能为空");

	let cursor = 0;

	// 渲染选项列表
	const render = () => {
		let out = `${Colors.cyan}?${Colors.reset} ${Colors.bold}${question}${Colors.reset} ${Colors.dim}(↑↓ 移动，Enter 确认)${Colors.reset}\n`;
		for (let i = 0; i < items.length; i++) {
			if (i === cursor) {
				out += `  ${Colors.green}❯ ${items[i].label}${Colors.reset}\n`;
			} else {
				out += `    ${Colors.dim}${items[i].label}${Colors.reset}\n`;
			}
		}
		output.write(out);
	};

	// 清除已渲染的行（1 题目行 + items.length 选项行）
	const clear = () => {
		for (let i = 0; i < items.length + 1; i++) {
			output.write(Colors.clearLine);
		}
		output.write("\r");
	};

	return new Promise((resolve) => {
		// 开启原始模式以捕获按键
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true);
		}
		process.stdin.resume();
		process.stdin.setEncoding("utf8");

		render();

		const onKey = (key: string) => {
			if (key === "\u001b[A" || key === "\u001bOA") {
				// ↑
				cursor = (cursor - 1 + items.length) % items.length;
				clear();
				render();
			} else if (key === "\u001b[B" || key === "\u001bOB") {
				// ↓
				cursor = (cursor + 1) % items.length;
				clear();
				render();
			} else if (key === "\r" || key === "\n") {
				// Enter
				process.stdin.removeListener("data", onKey);
				if (process.stdin.isTTY) {
					process.stdin.setRawMode(false);
				}
				process.stdin.pause();

				// 清除列表，打印最终选择
				clear();
				output.write(
					`${Colors.cyan}?${Colors.reset} ${Colors.bold}${question}${Colors.reset} ${Colors.green}❯ ${items[cursor].label}${Colors.reset}\n`
				);

				resolve(items[cursor].value);
			} else if (key === "\u0003") {
				// Ctrl+C
				process.exit(130);
			}
		};

		process.stdin.on("data", onKey);
	});
}
