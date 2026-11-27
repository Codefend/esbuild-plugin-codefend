import fs from "node:fs";
import path from "node:path";
import { build, context } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";
import { codefend, type IEsbuildCodefendOptions } from "..";
import { createFixture, execute, javascript, removeFixture } from "./helpers";

async function transform(
  options: IEsbuildCodefendOptions = {},
  source = "const l_value = 5; module.exports = l_value;",
): Promise<string> {
  const root = createFixture({ "entry.js": source });
  try {
    const result = await build({
      absWorkingDir: root,
      entryPoints: ["entry.js"],
      outfile: "bundle.cjs",
      bundle: true,
      platform: "node",
      format: "cjs",
      write: false,
      logLevel: "silent",
      plugins: [codefend({ debug: { stats: false }, ...options })],
    });
    const output = javascript(result);
    expect(execute(output)).toBe(5);
    return output;
  } finally {
    removeFixture(root);
  }
}

describe("Transformation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("obfuscates matching names using the default prefix", async () => {
    const output = await transform();
    expect(output).not.toMatch(/\bl_value\b/);
    expect(output).toMatch(/\bOx0\b/);
  });

  it("supports a custom prefix", async () => {
    expect(await transform({ transformation: { prefix: "Ax" } })).toMatch(/\bAx0\b/);
  });

  it("preserves ignored names", async () => {
    expect(await transform({ transformation: { ignore: ["l_value"] } })).toMatch(/\bl_value\b/);
  });

  it("uses explicit static replacements", async () => {
    const output = await transform({ transformation: { static: [{ from: "l_value", to: "secret" }] } });
    expect(output).not.toMatch(/\bl_value\b/);
    expect(output).toMatch(/\bsecret\b/);
  });

  it.each(["First Second", ["First", "Second"]])("accepts a word pool: %j", async (pool) => {
    expect(await transform({ transformation: { pool } })).toMatch(/\bfirst\b/);
  });

  it("reports the count of every repeated match", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await transform({ debug: { stats: true } });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/l_value.*Ox0.*2/));
  });

  it("supports silent statistics", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await transform();
    expect(log).not.toHaveBeenCalled();
  });

  it("resets statistics for each rebuild", async () => {
    const root = createFixture({ "entry.js": "const l_value = 5; module.exports = l_value;" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const buildContext = await context({
      absWorkingDir: root,
      entryPoints: ["entry.js"],
      outfile: "bundle.cjs",
      write: false,
      logLevel: "silent",
      plugins: [codefend()],
    });
    try {
      await buildContext.rebuild();
      await buildContext.rebuild();
      const tables = log.mock.calls.map(([value]) => String(value)).filter((value) => value.includes("l_value"));
      expect(tables).toHaveLength(2);
      for (const table of tables) expect(table).toMatch(/l_value.*Ox0.*2/);
    } finally {
      await buildContext.dispose();
      removeFixture(root);
    }
  });

  it("reports build errors without printing successful-build statistics", async () => {
    const root = createFixture({ "entry.js": "const l_value = ;" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(
        build({ entryPoints: [path.join(root, "entry.js")], write: false, logLevel: "silent", plugins: [codefend()] }),
      ).rejects.toThrow();
      expect(log).not.toHaveBeenCalled();
    } finally {
      removeFixture(root);
    }
  });

  it("surfaces module read failures as build errors", async () => {
    const root = createFixture({ "entry.js": "module.exports = 5;" });
    try {
      await expect(
        build({
          entryPoints: [path.join(root, "entry.js")],
          write: false,
          logLevel: "silent",
          plugins: [
            {
              name: "remove-fixture",
              setup(build) {
                build.onStart(() => {
                  fs.unlinkSync(path.join(root, "entry.js"));
                });
                build.onResolve({ filter: /entry\.js$/ }, () => ({ path: path.join(root, "entry.js") }));
              },
            },
            codefend({ debug: { stats: false } }),
          ],
        }),
      ).rejects.toThrow(/ENOENT/);
    } finally {
      removeFixture(root);
    }
  });
});
