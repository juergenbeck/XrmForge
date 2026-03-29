# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `@xrmforge/typegen` package with foundation modules:
  - Structured error hierarchy (`XrmForgeError` with 6 subclasses, 18 error codes)
  - Abstracted logging system (Console, JSON, Silent sinks with scoped loggers)
  - Resilient Dataverse HTTP client (retry with backoff, rate limiting, concurrency control, OData paging)
  - MSAL authentication (Client Credentials, Interactive Browser, Device Code flows)
  - Input sanitization helpers against OData injection
- Monorepo setup with pnpm, Turborepo, TypeScript strict mode, ESLint v9, Prettier
- 72 unit tests (Vitest)
