import { defineConfig } from "rolldown";
import * as fs from "node:fs";
import pkg from "./package.json" with { type: "json" };
import { execSync } from "node:child_process";

const gitHash = execSync("git rev-parse --short HEAD").toString().trim();

export default defineConfig({
	input: "src/index.ts",
	platform: "node",
	output: {
		dir: "dist",
		format: "es",
		strict: true,
		topLevelVar: true,
		postBanner: `/** 
 * ${pkg.name}@${pkg.version} (${gitHash})
 * @license AGPL 3.0 or later
 */`,
		minify: true,
		preserveModules: true,
		preserveModulesRoot: "src",
		// 注入 Shebang，确保作为命令可执行
		banner: "#!/usr/bin/env node"
	},
	plugins: [
		{
			name: "proto-inline",
			transform(code, id) {
				if (!id.endsWith(".proto")) return;
				// 将 .proto 文件内容转为 JS 字符串导出
				const content = fs.readFileSync(id, "utf8");
				return {
					code: `export default ${JSON.stringify(content)};`,
					map: null
				};
			}
		}
	],
	// 排除依赖项，不把它们打包进去
	external: [
		/^node:/,
		/^protobufjs$/,
		/^fastify$/,
		/^zod$/,
		/^zod\/v4\/core$/,
		/^ws$/,
		/^@inquirer\/prompts$/,
		/^@inquirer\/i18n$/,
		/^@satorijs\/protocol$/,
		/^@satorijs\/element/
	]
});
