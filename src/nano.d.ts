declare namespace NodeJS {
	interface ProcessEnv {
		NANO_ENV?: "cli" | "nocli";
	}
}

declare module "*.proto" {
	const content: string;
	export default content;
}
