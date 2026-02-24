/*import { Logger } from '../utils/logger.js';
import { request } from '../utils/http.js';

const log = new Logger({ prefix: 'Main' });

const url = "https://chat-go.jwzhd.com/v1/user/info"; // 替换为你的 URL

const response = await fetch(url, {
  headers: {
    token: global.appConfig?.account?.token,
  },
});

const buffer = await response.arrayBuffer();
log.info(Buffer.from(buffer).toString("hex"));
*/