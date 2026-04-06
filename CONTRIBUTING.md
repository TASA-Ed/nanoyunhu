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

## Coding Guidelines

- To ensure maintainability, the use of `any` for types is prohibited unless absolutely necessary.
- Explicitly specify function return types and parameter types; automatic type inference is prohibited.
- Use `type` when declaring types; do not use `interface` unless you are explicitly declaring a class interface.
- If a function needs to accept a logging object, use `ILogger` instead of `type Logger`.
- Type declaration files for a module are generally placed in the `types` folder within the module’s directory.

## Naming Conventions

- Prefix types with `T` and interfaces with `I`.
- Name constants using all uppercase letters and underscores; name (immutable and mutable) variables using lowercase camelCase; name functions using lowercase camelCase; and name types using uppercase camelCase.
- Name files and folders using all lowercase letters and underscores.
