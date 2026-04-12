import nanoRun from "./index.ts";
import { parseArgs, ParseArgsOptionsConfig } from "node:util";
import { existsSync } from "node:fs";
import AppPackage from "../package.json" with { type: "json" };

const options = {
	workdir: {
		type: "string",
		short: "w",
		default: process.cwd()
	},
	nocli: {
		type: "boolean",
		default: false,
		short: "n"
	},
	help: {
		type: "boolean",
		default: false,
		short: "h"
	},
	version: {
		type: "boolean",
		default: false,
		short: "v"
	}
} as const satisfies ParseArgsOptionsConfig;

const { values } = parseArgs({
	args: process.argv.slice(2),
	options
});

if (values.help) {
	console.log(`Usage: nanoyunhu [option]
Options:
  -h, --help               show help information.
  -v, --version            show nanoyunhu version.

  -w, --workdir < DIR >    specify a working directory.
  -n, --nocli              enable non-interactive mode(takes precedence over the NANO_ENV environment variable).`);
} else if (values.version) {
	console.log("NanoYunHu", AppPackage.version);
	console.log("Node", process.versions.node);
	console.log("V8", process.versions.v8);
	if (process.versions.electron) console.log("Electron", process.versions.electron);
} else {
	const workdir = existsSync(values.workdir) ? values.workdir : process.cwd();
	const nocli = values.nocli || process.env.NANO_ENV === "nocli";

	await nanoRun(nocli, workdir);
}
