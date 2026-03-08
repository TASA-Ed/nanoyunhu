declare namespace NodeJS {
	interface ProcessEnv {
		NANO_ENV?: "cli" | "docker";
	}
}
