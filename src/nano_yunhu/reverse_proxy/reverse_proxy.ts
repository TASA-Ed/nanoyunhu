import { registerImgProxy } from "./img.ts";
import { registerVideoProxy } from "./video.ts";
import { registerFileOssProxy } from "./file_oss.ts";
import { registerStorageProxy } from "./storage.ts";
import { registerFileProxy } from "./file.ts";
import { registerAudioProxy } from "./audio.ts";
import { fastifyPlugin } from "fastify-plugin";
import { type FastifyInstance } from "fastify";

export const imgProxy = fastifyPlugin(registerImgProxy);
export const videoProxy = fastifyPlugin(registerVideoProxy);
export const fileOssProxy = fastifyPlugin(registerFileOssProxy);
export const storageProxy = fastifyPlugin(registerStorageProxy);
export const fileProxy = fastifyPlugin(registerFileProxy);
export const audioProxy = fastifyPlugin(registerAudioProxy);

export const reverseProxy = fastifyPlugin((app: FastifyInstance): void => {
	app.register(imgProxy);
	app.register(videoProxy);
	app.register(fileOssProxy);
	app.register(storageProxy);
	app.register(fileProxy);
	app.register(audioProxy);
});
