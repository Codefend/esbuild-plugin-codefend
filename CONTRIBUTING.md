# Contributing Guidelines

Pull requests and bug reports are welcome. Please review the [Code of Conduct](./CODE_OF_CONDUCT.md).

Use [GitHub issues](https://github.com/Codefend/esbuild-plugin-codefend/issues) for bugs and feature requests, and [GitHub Discussions](https://github.com/Codefend/esbuild-plugin-codefend/discussions) for questions.

## Development

Use Node.js 24 LTS (24.11 or newer) and npm 11 for development. The published plugin supports Node.js 18 or newer; the development tools have newer runtime requirements.

From the repository root:

```sh
npm ci --include=dev --include=optional --bin-links
npm run format:check
npm run lint:check
npm run spell:check
npm run type:check
npm run test:coverage
npm run build
npm run test:package
npm pack --dry-run
```

`prepack` runs formatting, lint, spelling, type checks, tests, the build, and package checks. Package checks load both CommonJS and ESM entry points, verify declarations and build source maps, then build and execute esbuild output using the supported esbuild minor versions.

The build uses TypeScript 5 and tsdown to produce `dist/index.js`, `dist/index.mjs`, declarations, and source maps. The runtime source contains no esbuild import; esbuild is a peer dependency.

Integration tests cover module imports and properties, TypeScript and JSX loaders, custom loader overrides, pools, split chunks, rebuilds, concurrent contexts, and asset preservation. Temporary fixtures are created outside the source tree and removed after each test.

CI runs on pull requests, with checks on Linux and Windows. Runtime checks build the plugin on Node.js 24, then consume it on Node.js 18, 20, 22, 24, and 26. Dependabot version-update pull requests are paused with `open-pull-requests-limit: 0`.

## Examples

The [README](./README.md) contains esbuild configuration and naming examples. Broader language and build guides are maintained in the [Codefend documentation](https://codefend.github.io/docs/examples/list).

## Pull requests and releases

Include tests for behavior changes and use a descriptive conventional commit, such as `fix: ...` or `chore(deps): ...`.

Releases are manual: review the version and changelog, pass the checks, and publish with maintainer approval. No publishing workflow is configured.
