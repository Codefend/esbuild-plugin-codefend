# Changelog

## 3.2.2

- Add the esbuild plugin alongside the Codefend Vite, Rollup, and Webpack plugins, using Codefend 3.2.1 and schema-utils validation.
- Share the transformation and debug options, adapter and builder structure, and naming convention parser.
- Transform JavaScript, JSX, TypeScript, and TSX file modules before bundling, respecting esbuild loader overrides and preserving other asset types.
- Share mappings across modules, reserve pool names between modules, and reset build state for rebuilds and independent contexts.
- Provide CommonJS and ESM packages with declarations and build source maps through tsdown.
- Add real build and execution tests across esbuild 0.25 through 0.28, package consumption checks, coverage, and Linux/Windows CI.
- Run CI only on pull requests and pause Dependabot version updates, matching the existing plugin repositories.
- Keep examples in the README and link to the central documentation instead of bundling example projects.
