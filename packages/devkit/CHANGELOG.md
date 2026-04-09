# @xrmforge/devkit

## 0.7.4

### Patch Changes

- validate-form.mjs: 17 checks (new: FormContext cast detection, raw $filter field names)

## 0.7.3

### Patch Changes

- validate-form.mjs: recognize wrapCommand and re-exports (eliminates 39 false positives)
  AGENT.md: typed repetition beats untyped loops (8 typed lines > 1 loop with raw strings)

## 0.7.2

### Patch Changes

- AGENT.md: quality philosophy preamble (code reads like business logic, not API mechanics)

## 0.7.1

### Patch Changes

- AGENT.md: legacy helper function mapping table (25 functions mapped to XrmForge replacements)

## 0.7.0

### Minor Changes

- typedForm() with full single-parameter type inference, AGENT.md overhaul, stricter quality gate

  helpers:
  - typedForm<MyForm>(fc) now correctly infers field types from generated form interfaces
  - ExtractFields/ExtractAttributeMap/ExtractControlMap conditional types
  - No `as any` needed, full IDE autocomplete

  devkit:
  - AGENT.md: typedForm as primary pattern, entity-level Fields in select(), OptionSet Enums in FetchXML, named constants, pickLang(), Custom API Executors
  - validate-form.mjs: 15 checks (up from 6), catches raw strings in helpers/select/FetchXML
  - example-form.ts: demonstrates typedForm pattern

## 0.6.1

### Patch Changes

- Quality fixes: eliminate raw string literals, add catch type annotations
  - testing: semantic constants for Xrm enum defaults (isolatedModules compatible)
  - webapi: catch (error: unknown) on all CRUD methods
  - cli: catch (error: unknown) on all command handlers
  - devkit: FormNotificationLevel.Error in error-handler.ts template
  - typegen: catch (err: unknown) in file-writer

## 0.6.0

### Minor Changes

- Framework improvements from Round 5 analysis:
  - typegen: Always include statuscode/statecode in form Fields enum (system fields without FormXml control)
  - helpers: select() now accepts both variadic args and a single array
  - devkit: example-form.ts template rewritten with best practices (wrapHandler, Logger, Fields Enum, FormNotificationLevel)
  - devkit: validate-form.mjs quality gate script added to scaffold templates
