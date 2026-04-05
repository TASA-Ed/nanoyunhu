import { TActionValue, TButtonData } from "./types/button_types.ts";
import { ILogger } from "../../types.ts";

export function parseButton(button: string, log: ILogger): TButtonData | undefined {
	if (button === "[]" || button.trim().length === 0) return undefined;
	try {
		const outerData: TButtonData = JSON.parse(button);

		return outerData.map((row) =>
			row.map((item) => {
				if (typeof item.value === "string" && item.value !== "") {
					try {
						// 对 value 字符串进行二次解析
						item.value = JSON.parse(item.value) as TActionValue;
					} catch (e) {
						log.error("解析按钮 value 失败:", item.value);
						log.error(e);
					}
				}
				return item;
			})
		);
	} catch (e) {
		log.error("解析按钮失败:", button);
		log.error(e);
		return undefined;
	}
}
