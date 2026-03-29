# XrmForge

A next-generation TypeScript framework for Dynamics 365 CE / Model-Driven Apps.

## What is XrmForge?

XrmForge generates type-safe TypeScript declarations from your Dynamics 365 environment. It extends `@types/xrm` (never replaces it), ensuring full compatibility with PCF controls, third-party libraries, and the Microsoft ecosystem.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@xrmforge/typegen` | TypeScript declaration generator (core engine) | In development |
| `@xrmforge/cli` | Command-line interface | Planned |
| `@xrmforge/webapi` | Type-safe Web API client | Planned |
| `@xrmforge/formhelpers` | Form scripting utilities | Planned |
| `@xrmforge/devkit` | Project scaffolding & build configs | Planned |
| `@xrmforge/pipeline` | CI/CD templates | Planned |
| `@xrmforge/eslint-plugin` | D365-specific lint rules | Planned |

## Key Design Principles

- **Extend, don't replace** - All generated types build on `@types/xrm`
- **TypeScript all the way** - Tool, output, and DX are 100% TypeScript-native
- **esbuild-first, webpack-compatible** - Fast builds by default, compatibility when needed
- **MSAL-only authentication** - Modern `@azure/identity`, no deprecated ADAL
- **Enterprise CI/CD ready** - Built for Azure DevOps and GitHub Actions on Linux agents

## Development

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9
pnpm install
pnpm build
pnpm test
```

## License

[MIT](LICENSE)
