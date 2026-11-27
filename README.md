<p align="center">
 <img src="./public/img/logo.png">
</p>

# esbuild-plugin-codefend

[![Latest CI workflow status](https://img.shields.io/github/actions/workflow/status/Codefend/esbuild-plugin-codefend/ci.yaml)](https://github.com/Codefend/esbuild-plugin-codefend/actions/workflows/ci.yaml)
![NPM](https://img.shields.io/npm/dt/esbuild-plugin-codefend)
[![npm unpacked size](https://img.shields.io/npm/unpacked-size/esbuild-plugin-codefend)](https://www.npmjs.com/package/esbuild-plugin-codefend)
![NPM](https://img.shields.io/node/v/esbuild-plugin-codefend)
![NPM](https://img.shields.io/npm/l/esbuild-plugin-codefend)

esbuild plugin for code obfuscation based on [Codefend](https://www.npmjs.com/package/codefend).

Supports esbuild 0.25.12 and newer within esbuild 0.25, 0.26, 0.27, and 0.28.

## Installation

Install the plugin in your existing esbuild project:

```bash
npm install -D esbuild-plugin-codefend
```

## Usage

### Default options

Add the plugin to your `build.mjs`. Keep any other plugins and build settings your project needs.

```js
import { build } from "esbuild";
import { codefend } from "esbuild-plugin-codefend";

await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  outfile: "dist/bundle.js",
  plugins: [codefend()],
});
```

### Custom options

Customize obfuscation and statistics with the `transformation` and `debug` options:

```js
import { build } from "esbuild";
import { codefend } from "esbuild-plugin-codefend";

await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  outfile: "dist/bundle.js",
  plugins: [
    codefend({
      transformation: {
        // Prefix for generated names.
        prefix: "Ox",

        // Explicit replacements for selected words.
        static: [{ from: "predefined_secret", to: "123456" }],

        // Words that should retain their original spelling.
        ignore: ["node_modules"],

        // Optional names to use before generating prefixed names.
        pool: ["QueenOfHeart"],
      },
      debug: {
        // Display statistics for transformed words.
        stats: true,
      },
    }),
  ],
});
```

`transformation.ignore` contains words to preserve, not file paths or module filters. Statistics are enabled by default; use `debug: { stats: false }` to disable them.

The plugin uses Codefend's `codeOnly` parser. CLI options for copying source files, renaming files and folders, and selecting custom parsers are not exposed. See the [configuration reference](https://codefend.github.io/docs/references/configuration) for transformation details.

### Naming convention

Add a prefix such as `l_` to names you want Codefend to obfuscate:

```js
function l_add(l_left, l_right) {
  return l_left + l_right;
}

console.log(l_add(2, 3));
```

With default options, Codefend transforms those names:

```js
function Ox0(Ox1, Ox2) {
  return Ox1 + Ox2;
}

console.log(Ox0(2, 3));
```

Both versions print `5`. Generated names can vary with the input and build order. See the [code naming conventions](https://codefend.github.io/docs/basic-usage/naming-conventions/code-naming-convention) for other supported prefixes.

Codefend matches source text, so replacements can also affect strings and property names. Keep public exports, framework APIs, and external data contracts stable with `transformation.ignore`, and test the built application. Test custom pools across all modules before adopting them.

## Migrate an existing project with AI

Use the [AI migration prompt](https://codefend.github.io/docs/basic-usage/naming-conventions/ai-assisted-migration) to adapt an existing project's internal variables, functions, classes, parameters, and members to Codefend's naming conventions. The guide provides a copyable prompt that asks your coding assistant to update references, preserve external interfaces and data keys, and test both the renamed source and the Codefend output.

## Build behavior

The plugin transforms JavaScript and TypeScript file modules during esbuild's `onLoad` hook, before compilation, bundling, or minification, and prints statistics when a build succeeds. It runs whenever included in the configuration, including rebuilds and watch mode.

For development builds, include the plugin conditionally in your build script if you want to leave development output unchanged. Use file entry points with esbuild's asynchronous JavaScript build API. `stdin` input is not supported, and virtual modules or files supplied by another plugin's loader are not transformed. See the [esbuild guide](https://codefend.github.io/docs/examples/esbuild) for supported extensions, loader settings, asset behavior, and source map limitations.

Build with your usual project command, or run:

```bash
node build.mjs
```

## Examples

Follow the [esbuild example](https://codefend.github.io/docs/examples/esbuild) in the Codefend documentation for complete source code, configuration, build commands, and expected output.

## Documentation

- [Codefend documentation](https://codefend.github.io/docs/)
- [All language and build examples](https://codefend.github.io/docs/examples/list)
- [Vite plugin](https://www.npmjs.com/package/vite-plugin-codefend), [Rollup plugin](https://www.npmjs.com/package/rollup-plugin-codefend), and [Webpack plugin](https://www.npmjs.com/package/webpack-plugin-codefend)

## Contributing

Pull requests and bug reports are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development commands and contribution guidelines.

## License

[MIT](./LICENSE.md)
