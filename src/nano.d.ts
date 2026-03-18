declare namespace NodeJS {
	interface ProcessEnv {
		NANO_ENV?: "cli" | "docker";
		ROLLDOWN_WATCH?: "true" | "false";
	}
}

declare module '*.proto' {
	const content: string;
	export default content;
}
