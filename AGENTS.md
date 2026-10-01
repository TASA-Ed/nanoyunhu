# NanoYunhu

NanoYunhu 是 TypeScript 实现的云湖聊天软件协议端。

使用 Rolldown 构建，同时支持 Node 26 SEA 构建。

## 结构

- `src/` 代码
	- `index.ts` 入口
	- `types.ts` 类型与常量
	- `core/` 核心模块
		- `config.ts` 配置模块
		- `context.ts` APP 上下文
	- `plugin/` 插件模块
		- `internal` 内置插件
	- `utils/` 工具类
	- `nano_yunhu/` 应用
		- `cached/cached.ts` 缓存模块
		- `login/` 登录（Access Token 验证）逻辑
		- `message/` 消息逻辑
		- `protocols/` 协议逻辑
		  - `satori` Satori 协议实现
			- `utils` 协议工具
		- `reverse_proxy/` 反向代理逻辑
- `test/` Vitest 单元测试。
- `example_plugins/` 示例插件

## 附属包

- `@nanoyunhu/yunhu-protobuf-typeproto` 使用 typeproto 的 Protobuf 消息体与类型包。

## 代码规范

- 为了保证可维护性，类型不到万不得已，不要使用 `any`。
- 显式标注函数返回类型和参数类型，不要自动推断。
- 如果函数需要传入一个日志对象，类型选择 `src/types.ts` 的 `ILogger` 而不是 `src/utils/logger.ts` 的 `type Logger`。
- 如果需要使用 utils，不要直接导入，使用 APP Context 内的 UtilsService（如 ctx.utils.xxx）。其他服务如 protocol utils 同理。

## 命名规范

- 常量使用全大写字母与下划线命名，（不可变与可变）变量使用小驼峰命名，函数使用小驼峰命名，类型使用大驼峰命名。
- 文件与文件夹使用全小写字母与下划线命名。

## 编写提示

新增了 utils 或 protocol utils 需同步添加给 `utils_service.ts` 或 `protocol_service.ts`。

新增了逻辑需同步添加对应的测试，放在 `tests` 下，文件名使用 `*.test.ts`；`pnpm typecheck` 同时检查测试代码。

测试尚不覆盖 `reverse_proxy` 和 `satori`，暂时没有必要。
