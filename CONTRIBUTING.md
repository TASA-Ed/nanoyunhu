# Contributing

[中文](CONTRIBUTING.zh.md)

## Development

### Development Projects

Note: This will not run automatically; please run `./dist/bin.js` manually.

```bash
pnpm dev
```

### Type checking

```bash
pnpm typecheck
```

### Unit tests

Vitest tests cover selected utilities, core behavior, and plugins in `tests/utils`, `tests/core`, and `tests/plugin`, not the entire project. Utility tests include logger filtering and serialization, context isolation, HTTP responses, and server/WebSocket lifecycles. Plugin tests cover module validation, hook ordering and error isolation, and built-in status replies.

```bash
pnpm test
# Watch mode
pnpm test:watch
# Run a single directory
pnpm test tests/core
pnpm test tests/utils tests/plugin
```

Tests run in Node; configuration and plugin-loading tests use temporary directories and do not modify the project's `config.json`. Server tests use loopback addresses and ephemeral ports; WebSocket tests use a transport substitute, real protobuf encoding/decoding, and fake timers without contacting external services.
Add `*.test.ts` files under `tests`; `pnpm typecheck` also checks test code.
The GitHub Actions Unit Tests workflow runs type checking and tests on Linux and Windows with Node 26 / pnpm 11 for pushes and pull requests targeting main, and manual dispatches.

### Lint

Note: Linting is performed automatically upon submission.

```bash
pnpm lint
# Auto-repair
pnpm lint:fix
```

### Format

Note: The text will be automatically formatted upon submission.

```bash
pnpm fmt
# Check only
pnpm fmt:check
```

## Coding Guidelines

- To ensure maintainability, the use of `any` for types is prohibited unless absolutely necessary.
- Explicitly specify function return types and parameter types; automatic type inference is prohibited.
- Use `type` when declaring types; do not use `interface` unless you are explicitly declaring a class interface.
- If a function needs to accept a logger object, use the `ILogger` type from `src/types.ts` instead of the `type Logger` from `src/utils/logger.ts`.
- Type declaration files for a module are generally placed in the `types` folder within the module’s directory.

## Naming Conventions

- Prefix types with `T` and interfaces with `I`.
- Name constants using all uppercase letters and underscores; name (immutable and mutable) variables using lowercase camelCase; name functions using lowercase camelCase; and name types using uppercase camelCase.
- Name files and folders using all lowercase letters and underscores.
