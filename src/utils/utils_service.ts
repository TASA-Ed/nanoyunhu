import {
	generateMsgID,
	generateUUIDv4,
	generateString,
	generateUUIDv7,
	generateInt,
	generateWssSeq
} from "#/utils/generate.ts";
import { request } from "#/utils/http.ts";
import { formatTimestampDiff } from "#/utils/time.ts";
import { WssClient } from "#/utils/wss.ts";
import { Logger } from "#/utils/logger.ts";
import {
	generateDeviceId,
	getIdAndPlatform,
	getMemToMiB,
	getPlatform,
	getSystemInfo,
	hardwareRequirementsAssessment
} from "#/utils/device.ts";
import { Context } from "#/core/context.ts";
import type { ILogger } from "#/types.ts";

export class UtilsService {
	private readonly ctx: Context;

	generateUUIDv4 = generateUUIDv4;
	generateUUIDv7 = generateUUIDv7;
	generateWssSeq = generateWssSeq;
	generateMsgID = generateMsgID;
	generateString = generateString;
	generateInt = generateInt;
	request = request;
	formatTimestampDiff = formatTimestampDiff;
	WssClient = WssClient;
	logger = Logger;
	getMemToMiB = getMemToMiB;
	getSystemInfo = getSystemInfo;
	generateDeviceId = generateDeviceId;
	getIdAndPlatform = (log: ILogger) => getIdAndPlatform(this.ctx, log);
	getPlatform = () => getPlatform(this.ctx);
	hardwareRequirementsAssessment = hardwareRequirementsAssessment;

	constructor(ctx: Context) {
		this.ctx = ctx;
	}
}
