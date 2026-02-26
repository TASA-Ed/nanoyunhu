import { defineConfig } from 'rolldown';

export default defineConfig({
	input: 'src/index.ts',
	output: {
		dir: 'dist',
		format: 'es',
		preserveModules: true,
		preserveModulesRoot: 'src',
		// 注入 Shebang，确保作为命令可执行
		banner: '#!/usr/bin/env node',
	},
	// 排除 Node 原生模块（例如 node:fs, node:util），不把它们打包进去
	external: [/^node:/, /^protobufjs/, /^fastify/, /^zod/, /^ws/],
});
