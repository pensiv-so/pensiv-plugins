# Changesets

This folder holds [changesets](https://github.com/changesets/changesets) — one
markdown file per pending release note for the **publishable** packages
(`@pensiv/plugin-sdk`, `@pensiv/build-config`, `@pensiv/plugin-ui`,
`create-pensiv-plugin`).

Add one when you change a published package:

```bash
npx changeset
```

Pick the semver bump and write a short summary. Commit the generated file with
your PR. The release workflow opens a "Version Packages" PR that consumes these,
bumps versions, updates changelogs, and publishes on merge.

Plugins under `plugins/*` are `private` and are never published, so they don't
need changesets.
