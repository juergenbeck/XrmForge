# XrmForge

A next-generation TypeScript framework for Dynamics 365 CE / Model-Driven Apps.

## What is XrmForge?

XrmForge generates type-safe TypeScript declarations from your Dynamics 365 environment. It extends `@types/xrm` (never replaces it), ensuring full compatibility with PCF controls, third-party libraries, and the Microsoft ecosystem.

**Before XrmForge:**
```typescript
const formContext = executionContext.getFormContext();
const name = formContext.getAttribute("name");       // Xrm.Attributes.Attribute (generic)
name.setValue(123);                                   // No compile error, runtime crash!
```

**After XrmForge:**
```typescript
const formContext = executionContext.getFormContext() as XrmForge.Forms.Account.AccountAccountForm;
const name = formContext.getAttribute("name");       // Xrm.Attributes.StringAttribute (specific)
name.setValue(123);                                   // Compile error: number is not string!
```

## Features

- **Entity Interfaces** with all attributes correctly typed (string, number, boolean, Lookup, OptionSet)
- **Form Interfaces** with typed `getAttribute()` and `getControl()` overloads per form
- **OptionSet Enums** as `const enum` (zero runtime overhead)
- **Dual-Language Labels** in JSDoc comments (`/** Account Name | Firmenname */`)
- **Parallel Processing** for fast generation of large entity sets
- **Graceful Abort** via AbortSignal (Ctrl+C support in CLI)
- **Read-Only by Default** - never modifies data in your Dataverse environment

## Quick Start

```bash
# Install globally
npm install -g @xrmforge/cli

# Generate types from your environment
xrmforge generate \
  --url https://myorg.crm4.dynamics.com \
  --auth interactive \
  --tenant-id <tenant-id> --client-id <app-id> \
  --entities account,contact,opportunity \
  --output ./typings \
  --secondary-language 1031
```

## Generated Output

```typescript
// typings/entities/account.d.ts
declare namespace XrmForge.Entities {
  /** Account | Firma */
  interface Account {
    /** Account Name | Firmenname */
    name?: string;
    /** Main Phone | Haupttelefon */
    telephone1?: string;
    /** Annual Revenue | Jahresumsatz */
    revenue?: number;
    /** Primary Contact - Lookup (contact) */
    _primarycontactid_value?: string;
  }
}

// typings/optionsets/account.d.ts
declare namespace XrmForge.OptionSets {
  const enum IndustryCode {
    /** Accounting | Buchhaltung */
    Accounting = 1,
    /** Agriculture | Landwirtschaft */
    Agriculture = 2,
  }
}

// typings/forms/account.d.ts
declare namespace XrmForge.Forms.Account {
  interface AccountMainForm extends Omit<Xrm.FormContext, 'getAttribute' | 'getControl'> {
    getAttribute(name: "name"): Xrm.Attributes.StringAttribute;
    getAttribute(name: "revenue"): Xrm.Attributes.NumberAttribute;
    getAttribute(name: "primarycontactid"): Xrm.Attributes.LookupAttribute;
    getAttribute(name: string): Xrm.Attributes.Attribute;

    getControl(name: "name"): Xrm.Controls.StringControl;
    getControl(name: "revenue"): Xrm.Controls.NumberControl;
    getControl(name: "primarycontactid"): Xrm.Controls.LookupControl;
    getControl(name: string): Xrm.Controls.Control;
  }
}
```

## Authentication

Three methods supported, all via `@azure/identity` (MSAL):

| Method | Use Case | Flags |
|--------|----------|-------|
| `interactive` | Local development (opens browser) | `--tenant-id --client-id` |
| `client-credentials` | CI/CD pipelines (Service Principal) | `--tenant-id --client-id --client-secret` |
| `device-code` | Headless environments | `--tenant-id --client-id` |

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| `@xrmforge/typegen` | TypeScript declaration generator (core engine) | v0.1.0 |
| `@xrmforge/cli` | Command-line interface | v0.1.0 |
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
- **Read-only by default** - Type generation never modifies your Dataverse data

## Development

```bash
# Prerequisites: Node.js >= 20, pnpm >= 9
pnpm install
pnpm build
pnpm test     # 308 tests across 2 packages
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
