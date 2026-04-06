# Contributing

[中文](CONTRIBUTING.zh.md)

## Development

### Development Projects

Note: This will not run automatically; please run `./dist/index.js` manually.

```bash
pnpm dev
```

### Type checking

```bash
pnpm typecheck
```

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
- If a function needs to accept a logging object, use `ILogger` instead of `type Logger`.
- Type declaration files for a module are generally placed in the `types` folder within the module’s directory.

## Naming Conventions

- Prefix types with `T` and interfaces with `I`.
- Name constants using all uppercase letters and underscores; name (immutable and mutable) variables using lowercase camelCase; name functions using lowercase camelCase; and name types using uppercase camelCase.
- Name files and folders using all lowercase letters and underscores.
