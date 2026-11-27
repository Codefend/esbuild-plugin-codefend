import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const commonjs = require(resolve(root, manifest.main));
const esm = await import(pathToFileURL(resolve(root, manifest.module)).href);

assert.deepEqual(Object.keys(commonjs), ["codefend"]);
assert.deepEqual(Object.keys(esm), ["codefend"]);
for (const entry of [manifest.main, manifest.module, manifest.types, "dist/index.d.mts"]) {
  assert.ok(readFileSync(resolve(root, entry)).length, "Missing package entry: " + entry);
}
for (const entry of [manifest.main, manifest.module]) {
  const source = readFileSync(resolve(root, entry), "utf8");
  assert.ok(source.includes("sourceMappingURL="));
  const map = JSON.parse(readFileSync(resolve(root, entry + ".map"), "utf8"));
  assert.ok(map.sources.length > 0 && map.sourcesContent.length > 0);
}

const fixtureParent = realpathSync.native(tmpdir());
const fixture = mkdtempSync(join(fixtureParent, "codefend-esbuild-package-"));
const versions = [];
try {
  writeFileSync(join(fixture, "entry.js"), 'import { l_add } from "./math.js"; module.exports = l_add(2, 3);');
  writeFileSync(join(fixture, "math.js"), "export function l_add(l_left, l_right) { return l_left + l_right; }");
  for (const name of ["esbuild-0.25", "esbuild-0.26", "esbuild-0.27", "esbuild"]) {
    const { build, version } = await import(name);
    versions.push(version);
    for (const api of [commonjs, esm]) {
      const plugin = api.codefend({ debug: { stats: false } });
      assert.equal(plugin.name, "esbuild-plugin-codefend");
      assert.deepEqual(Object.keys(plugin).sort(), ["name", "setup"]);
      const result = await build({
        absWorkingDir: fixture,
        entryPoints: ["entry.js"],
        bundle: true,
        platform: "node",
        format: "cjs",
        outfile: "bundle.cjs",
        write: false,
        logLevel: "silent",
        plugins: [plugin],
      });
      assert.equal(result.outputFiles.length, 1);
      const code = result.outputFiles[0].text;
      assert.doesNotMatch(code, /\bl_(?:add|left|right)\b/);
      const module = { exports: {} };
      vm.runInNewContext(code, { module, exports: module.exports });
      assert.equal(module.exports, 5);
    }
  }
} finally {
  if (
    dirname(resolve(fixture)) !== resolve(fixtureParent) ||
    !basename(fixture).startsWith("codefend-esbuild-package-")
  ) {
    throw new Error("Refusing to remove a directory outside the package fixtures.");
  }
  rmSync(fixture, { recursive: true, force: true });
}

const core = JSON.parse(readFileSync(resolve(dirname(require.resolve("codefend")), "../package.json"), "utf8"));
console.log(
  JSON.stringify({
    node: process.version,
    plugin: manifest.version,
    codefend: core.version,
    esbuild: versions,
    checks: ["CommonJS", "ESM", "declarations", "source maps", "esbuild compilation/execution"],
  }),
);
