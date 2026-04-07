import nanoRun from "./index.ts";
import { parseArgs, ParseArgsOptionsConfig } from "node:util";
import { existsSync } from "node:fs";

const options = {
	workdir: {
		type: "string",
		short: "w",
		default: process.cwd()
	}
} as const satisfies ParseArgsOptionsConfig;

const { values } = parseArgs({
	args: process.argv.slice(2),
	options
});

await nanoRun(process.env.NANO_ENV === "nocli", existsSync(values.workdir) ? values.workdir : process.cwd());
