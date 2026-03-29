# Changesets

This directory is used by [Changesets](https://github.com/changesets/changesets) to
manage versioning and changelogs for published packages.

## Adding a changeset

```bash
pnpm changeset
```

This prompts you to select affected packages, a semver bump type, and a summary.
The generated `.md` file in this directory is committed with your PR.

## Publishing

Maintainers run:

```bash
pnpm version-packages  # Applies changesets to package versions and CHANGELOG
pnpm release            # Builds and publishes to npm
```
