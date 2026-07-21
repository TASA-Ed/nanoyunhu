import { defineConfig } from "rolldown";
import pkg from "./package.json" with { type: "json" };
import { execSync } from "node:child_process";
import { builtinModules } from "node:module";

const gitHash: string = execSync("git rev-parse --short HEAD").toString().trim();

const externals: (RegExp | string)[] = [
	/^node:/,
	"zod/v4/core",
	...builtinModules,
	...Object.keys({
		...pkg.dependencies
	})
];

export default defineConfig({
	input: "src/index.ts",
	platform: "node",
	output: {
		file: "dist/index.js",
		format: "es",
		cleanDir: true,
		strict: true,
		topLevelVar: true,
		postBanner: `/** 
 * ${pkg.name}@${pkg.version} (${gitHash})
 * @license AGPL 3.0 or later
 */`,
		minify: true,
		banner: "#!/usr/bin/env node"
	},
	external: externals
});
