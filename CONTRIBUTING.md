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

## Coding Conventions

- To ensure maintainability, the use of `any` for types is prohibited unless absolutely necessary.
- Explicitly specify function return types and parameter types; automatic type inference is prohibited.
- If a function needs to accept a logging object as a parameter, use the `ILogger` type from `src/types.ts` rather than the `type Logger` from `src/utils/logger.ts`.
- If you need to use `utils`, do not import them directly; instead, use the `UtilsService` within the APP Context (e.g., `ctx.utils.xxx`). The same applies to other services, such as `protocol utils`.

## Naming Conventions

- Constants should be named using all uppercase letters and underscores; (immutable and mutable) variables should use lower camelCase; functions should use lower camelCase; and types should use upper camelCase.
- Files and folders should be named using all lowercase letters and underscores.
