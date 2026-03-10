import { defineConfig } from "rolldown";

export default defineConfig({
	input: "src/index.ts",
	output: {
		dir: "dist",
		format: "es",
		preserveModules: true,
		preserveModulesRoot: "src",
		// 注入 Shebang，确保作为命令可执行
		banner: "#!/usr/bin/env node"
	},
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
