import { defineConfig, RolldownPluginOption } from "rolldown";
import * as fs from "node:fs";
import pkg from "./package.json" with { type: "json" };
import { execSync } from "node:child_process";

const gitHash: string = execSync("git rev-parse --short HEAD").toString().trim();

const protoInline: RolldownPluginOption = {
	name: "proto-inline",
	transform(_code: string, id: string) {
		if (!id.endsWith(".proto")) return;
		const content = fs.readFileSync(id, "utf8");
		return { code: `export default ${JSON.stringify(content)};`, map: null };
	}
};

const externals: RegExp[] = [/^node:/];

export default defineConfig({
	input: "src/index.ts",
	platform: "node",
	output: {
		file: "dist/sea.js",
		format: "es",
		strict: true,
		topLevelVar: true,
		postBanner: `/** 
 * ${pkg.name}@${pkg.version} (${gitHash})
 * @license AGPL 3.0 or later
 */`,
		minify: true
	},
	plugins: [protoInline],
	external: externals
});
