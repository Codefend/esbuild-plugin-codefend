import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { BuildContext, BuildOptions, BuildResult, Plugin } from "esbuild";
import { describe, expect, it, vi } from "vitest";
import { codefend } from "..";
import { createFixture, execute, javascript, removeFixture } from "./helpers";

type Bundler = {
  build(options: BuildOptions): Promise<BuildResult>;
  context(options: BuildOptions): Promise<BuildContext>;
};

const bundlers: { name: string; load: () => Promise<Bundler> }[] = [
  { name: "esbuild 0.25", load: () => import("esbuild-0.25") },
  { name: "esbuild 0.26", load: () => import("esbuild-0.26") },
  { name: "esbuild 0.27", load: () => import("esbuild-0.27") },
  { name: "esbuild 0.28", load: () => import("esbuild") },
];

function options(root: string, overrides: BuildOptions = {}): BuildOptions {
  return {
    absWorkingDir: root,
    entryPoints: ["entry.js"],
    outfile: "bundle.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    logLevel: "silent",
    plugins: [codefend({ debug: { stats: false } })],
    ...overrides,
  };
}

describe.each(bundlers)("$name compatibility", ({ load }) => {
  it("builds and executes shared imports, exports, and properties across modules", async () => {
    const { build } = await load();
    const root = createFixture({
      "entry.js":
        'import { l_add } from "./nested/math.js"; const l_data = { l_value: 2 }; module.exports = l_add(l_data.l_value, 3);',
      "nested/math.js": "export function l_add(l_left, l_right) { return l_left + l_right; }",
    });
    try {
      const output = javascript(await build(options(root)));
      expect(output).not.toMatch(/\bl_(?:add|left|right|data|value)\b/);
      expect(execute(output)).toBe(5);
    } finally {
      removeFixture(root);
    }
  });

  it("allocates distinct pool names across modules without changing existing mappings", async () => {
    const { build } = await load();
    const root = createFixture({
      "entry.js": 'import { l_double } from "./math.js"; const l_input = 21; module.exports = l_double(l_input);',
      "math.js": "export function l_double(l_value) { return l_value * 2; }",
    });
    try {
      const output = javascript(
        await build(
          options(root, {
            plugins: [codefend({ transformation: { pool: ["alpha", "bravo", "charlie"] }, debug: { stats: false } })],
          }),
        ),
      );
      expect(output).not.toMatch(/\bl_(?:double|value|input)\b/);
      expect(output).toMatch(/\balpha\b/);
      expect(output).toMatch(/\bbravo\b/);
      expect(output).toMatch(/\bcharlie\b/);
      expect(execute(output)).toBe(42);
    } finally {
      removeFixture(root);
    }
  });

  it.each(["js", "mjs", "cjs", "ts", "mts", "cts", "jsx", "tsx"])("preserves the %s loader", async (extension) => {
    const { build } = await load();
    const jsx = extension.endsWith("sx");
    const source = jsx
      ? "const React = { createElement: (tag, props, value) => value }; const l_value = <span>{5}</span>; module.exports = l_value;"
      : extension.includes("ts")
        ? "const l_value: number = 5; export default l_value;"
        : "const l_value = 5; export default l_value;";
    const root = createFixture({ [`entry.${extension}`]: source });
    try {
      const output = javascript(await build(options(root, { entryPoints: [`entry.${extension}`] })));
      expect(output).not.toMatch(/\bl_value\b/);
      const value = execute(output);
      expect(jsx ? value : (value as { default: number }).default).toBe(5);
    } finally {
      removeFixture(root);
    }
  });

  it("honors custom JavaScript loaders and preserves files loaded as text", async () => {
    const { build } = await load();
    const root = createFixture({
      "entry.js":
        'import text from "./literal.js"; import { l_value } from "./value.custom"; module.exports = [text, l_value];',
      "literal.js": "l_original_text",
      "value.custom": "export const l_value: number = 5;",
    });
    try {
      const output = javascript(
        await build(
          options(root, {
            entryPoints: ["value.custom"],
            loader: { ".custom": "ts" },
          }),
        ),
      );
      expect(output).not.toMatch(/\bl_value\b/);

      fs.renameSync(path.join(root, "entry.js"), path.join(root, "entry.cjs"));
      const literalOutput = javascript(
        await build(
          options(root, {
            entryPoints: ["entry.cjs"],
            loader: { ".js": "text", ".custom": "ts" },
          }),
        ),
      );
      expect(execute(literalOutput)).toEqual(["l_original_text", 5]);
    } finally {
      removeFixture(root);
    }
  });

  it("preserves CSS, JSON, binary assets, and the normal write behavior", async () => {
    const { build } = await load();
    const root = createFixture({
      "entry.js":
        'import "./style.css"; import data from "./data.json"; import url from "./asset.bin"; const l_value = data.l_value; module.exports = [l_value, url];',
      "style.css": ".l_red { color: red; }",
      "data.json": '{"l_value":5}',
      "asset.bin": "placeholder",
    });
    const bytes = Buffer.from([0, 255, 128, 13, 10, 42]);
    fs.writeFileSync(path.join(root, "asset.bin"), bytes);
    try {
      const result = await build(
        options(root, {
          // JSON keys are external data names and must stay stable in JavaScript too.
          plugins: [codefend({ transformation: { ignore: ["l_value"] }, debug: { stats: false } })],
          outfile: "dist/bundle.cjs",
          loader: { ".bin": "file" },
          write: true,
        }),
      );
      expect(result.outputFiles).toBeUndefined();
      expect(fs.readFileSync(path.join(root, "dist/bundle.css"), "utf8")).toContain(".l_red");
      const asset = fs.readdirSync(path.join(root, "dist")).find((file) => file.endsWith(".bin"));
      expect(fs.readFileSync(path.join(root, "dist", asset!))).toEqual(bytes);
      const values = execute(fs.readFileSync(path.join(root, "dist/bundle.cjs"), "utf8")) as [number, string];
      expect(values[0]).toBe(5);
      expect(values[1]).toContain(".bin");
    } finally {
      removeFixture(root);
    }
  });

  it("executes dynamic imports and shared exports across split chunks", async () => {
    const { build } = await load();
    const root = createFixture({
      "entry.js":
        'export default async () => { const { l_double } = await import("./lazy.js"); return l_double(21); };',
      "lazy.js": "export function l_double(l_value) { return l_value * 2; }",
    });
    try {
      const result = await build(
        options(root, {
          outfile: undefined,
          outdir: "dist",
          format: "esm",
          splitting: true,
          outExtension: { ".js": ".mjs" },
        }),
      );
      expect(result.outputFiles!.length).toBeGreaterThan(1);
      for (const file of result.outputFiles!) {
        expect(file.text).not.toMatch(/\bl_(?:double|value)\b/);
        fs.mkdirSync(path.dirname(file.path), { recursive: true });
        fs.writeFileSync(file.path, file.contents);
      }
      const entry = await import(pathToFileURL(path.join(root, "dist/entry.mjs")).href);
      await expect(entry.default()).resolves.toBe(42);
    } finally {
      removeFixture(root);
    }
  });

  it("rebuilds unchanged and edited modules with fresh, consistent mappings", async () => {
    const { context } = await load();
    const root = createFixture({
      "entry.js": 'import { l_value } from "./value.js"; module.exports = l_value;',
      "value.js": "export const l_value = 5;",
    });
    const buildContext = await context(options(root));
    try {
      expect(execute(javascript(await buildContext.rebuild()))).toBe(5);
      fs.writeFileSync(path.join(root, "value.js"), "const l_other = 7; export const l_value = l_other;");
      const output = javascript(await buildContext.rebuild());
      expect(output).not.toMatch(/\bl_(?:value|other)\b/);
      expect(execute(output)).toBe(7);
    } finally {
      await buildContext.dispose();
      removeFixture(root);
    }
  });

  it("isolates concurrent builds that reuse the same plugin instance", async () => {
    const { build } = await load();
    const root = createFixture({
      "first.js": "const l_first = 5; module.exports = l_first;",
      "second.js": "const l_second = 7; module.exports = l_second;",
    });
    const plugin = codefend({ debug: { stats: false } });
    try {
      const results = await Promise.all(
        ["first.js", "second.js"].map((entry) =>
          build(
            options(root, {
              entryPoints: [entry],
              plugins: [plugin],
            }),
          ),
        ),
      );
      expect(results.map((result: BuildResult) => execute(javascript(result)))).toEqual([5, 7]);
      for (const result of results) expect(javascript(result)).toMatch(/\bOx0\b/);
    } finally {
      removeFixture(root);
    }
  });

  it("leaves virtual modules and modules owned by an earlier loader to that plugin", async () => {
    const { build } = await load();
    const root = createFixture({ "entry.js": "this file is supplied by a custom loader" });
    const loader: Plugin = {
      name: "fixture-loader",
      setup(build) {
        build.onResolve({ filter: /^virtual:/ }, () => ({ path: "value", namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const value = 5;" }));
        build.onLoad({ filter: /entry\.js$/, namespace: "file" }, () => ({
          contents: 'import { value } from "virtual:value"; const l_loaded = value; module.exports = l_loaded;',
        }));
      },
    };
    try {
      const output = javascript(
        await build(
          options(root, {
            plugins: [loader, codefend({ debug: { stats: false } })],
          }),
        ),
      );
      expect(output).toMatch(/\bl_loaded\b/);
      expect(execute(output)).toBe(5);
    } finally {
      removeFixture(root);
    }
  });

  it("rejects stdin builds instead of silently leaving names unchanged", async () => {
    const { build } = await load();
    await expect(
      build({
        stdin: { contents: "const l_value = 5;" },
        write: false,
        logLevel: "silent",
        plugins: [codefend({ debug: { stats: false } })],
      }),
    ).rejects.toThrow(/requires file entry points/);
  });
});

describe("Watch mode", () => {
  it("rebuilds when a file loaded by Codefend changes", async () => {
    const { context } = await import("esbuild");
    const root = createFixture({ "entry.js": "const l_value = 5; module.exports = l_value;" });
    const output = path.join(root, "bundle.cjs");
    const buildContext = await context(options(root, { write: true }));
    try {
      await buildContext.watch();
      await vi.waitFor(
        () => {
          expect(execute(fs.readFileSync(output, "utf8"))).toBe(5);
        },
        { timeout: 5_000 },
      );

      fs.writeFileSync(path.join(root, "entry.js"), "const l_value = 7; module.exports = l_value;");
      await vi.waitFor(
        () => {
          const code = fs.readFileSync(output, "utf8");
          expect(code).not.toMatch(/\bl_value\b/);
          expect(execute(code)).toBe(7);
        },
        { timeout: 5_000 },
      );
    } finally {
      await buildContext.dispose();
      removeFixture(root);
    }
  });
});
