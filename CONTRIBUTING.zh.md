# 贡献指南

[English](CONTRIBUTING.md)

## 开发

### 开发项目

注：不会自动运行，请手动运行 `./dist/bin.js`。

```bash
pnpm dev
```

### 类型检查

```bash
pnpm typecheck
```

### 单元测试

使用 Vitest，测试位于 `tests/utils`、`tests/core` 和 `tests/plugin`，暂不覆盖整个项目。工具测试包括日志过滤与序列化、上下文隔离、HTTP 响应、服务器及 WebSocket 生命周期；插件测试包括模块加载校验、hook 顺序与错误隔离，以及内置状态回复。

```bash
pnpm test
# 监听模式
pnpm test:watch
# 仅运行指定目录
pnpm test tests/core
pnpm test tests/utils tests/plugin
```

测试使用 Node 环境，配置和插件加载测试在临时目录中运行，不会修改项目的 `config.json`。服务器测试使用本机回环地址和临时端口；WebSocket 测试使用传输替身、真实 protobuf 编解码及虚拟计时器，不连接外部服务。
新增测试请放在 `tests` 下，文件名使用 `*.test.ts`；`pnpm typecheck` 同时检查测试代码。
GitHub Actions 的 Unit Tests 工作流在 main 分支的 push、pull request 及手动触发时，使用 Node 26 / pnpm 11 在 Linux 和 Windows 上运行类型检查和测试。

### Lint

注：提交时会自动 Lint。

```bash
pnpm lint
# 自动修复
pnpm lint:fix
```

### 格式化

注：提交时会自动 格式化。

```bash
pnpm fmt
# 仅检查
pnpm fmt:check
```

## 代码规范

- 为了保证可维护性，类型不到万不得已，禁止使用 `any`。
- 显式标注函数返回类型和参数类型，禁止自动推断。
- 如果函数需要传入一个日志对象，类型选择 `src/types.ts` 的 `ILogger` 而不是 `src/utils/logger.ts` 的 `type Logger`。
- 如果需要使用 utils，不要直接导入，使用 APP Context 内的 UtilsService（如 ctx.utils.xxx）。其他服务如 protocol utils 同理。

## 命名规范

- 常量使用全大写字母与下划线命名，（不可变与可变）变量使用小驼峰命名，函数使用小驼峰命名，类型使用大驼峰命名。
- 文件与文件夹使用全小写字母与下划线命名。
