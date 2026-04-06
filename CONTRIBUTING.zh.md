# 贡献指南

[English](CONTRIBUTING.md)

## 开发

### 开发项目

注：不会自动运行，请手动运行 `./dist/index.js`。

```bash
pnpm dev
```

### 类型检查

```bash
pnpm typecheck
```

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
- 声明类型时使用 `type`，不要使用 `interface`，除非真的声明类的接口。
- 如果函数需要传入一个日志对象，类型选择 `ILogger` 而不是 `type Logger`。
- 模块的类型声明文件一般放入模块所在目录的 `types` 文件夹。

## 命名规范

- 类型使用 `T` 为前缀，接口使用 `I` 为前缀。
- 常量使用全大写字母与下划线命名，（不可变与可变）变量使用小驼峰命名，函数使用小驼峰命名，类型使用大驼峰命名。
- 文件与文件夹使用全小写字母与下划线命名。
