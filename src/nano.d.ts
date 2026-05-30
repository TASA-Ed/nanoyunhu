declare namespace NodeJS {
	interface ProcessEnv {}
}

declare module "*.proto" {
	const content: string;
	export default content;
}
