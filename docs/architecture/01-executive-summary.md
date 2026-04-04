# Executive Summary

XrmForge is an open-source TypeScript toolkit for type-safe Dynamics 365 / Dataverse WebResource development. It generates TypeScript declarations from live Dataverse metadata, turning runtime string errors into compile-time type errors.

**Core value proposition:** Every field name, OptionSet value, tab name, entity name, and subgrid name becomes a typed constant with IDE autocomplete and compile-time validation.

**Target audience:** D365 developers who write form scripts (WebResources) in JavaScript/TypeScript and want compile-time safety, zero magic strings, and modern tooling (esbuild, vitest, ESLint).

**Tech stack:** TypeScript, pnpm monorepo with Turborepo, esbuild for IIFE bundles, vitest for testing, @azure/identity for authentication, fast-xml-parser for FormXml parsing.

**npm organization:** [@xrmforge](https://www.npmjs.com/org/xrmforge)
