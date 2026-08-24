---
'create-pensiv-plugin': minor
---

First release. The scaffolder sits at 0.0.0 and has never been published, so
`npm create pensiv-plugin` does not resolve — and the project it generates
depends on `@pensiv/build-config`, which has not been published either. Cutting
0.1.0 alongside the first `@pensiv/build-config` and `@pensiv/plugin-ui`
releases is what makes authoring a plugin outside this monorepo work at all.
