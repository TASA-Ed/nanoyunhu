export const APP_NAME = "My Awesome Svelte CLI";

// 前后端共享的类型定义
export interface ServerResponse {
  status: 'success' | 'error';
  message: string;
}