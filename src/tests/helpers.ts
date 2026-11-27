import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import type { BuildResult } from "esbuild";

const fixtureParent = fs.realpathSync.native(os.tmpdir());

export function createFixture(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(fixtureParent, "codefend-esbuild-test-"));
  for (const [name, source] of Object.entries(files)) {
    const destination = path.join(root, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, source);
  }
  return root;
}

export function removeFixture(root: string): void {
  if (
    path.dirname(path.resolve(root)) !== path.resolve(fixtureParent) ||
    !path.basename(root).startsWith("codefend-esbuild-test-")
  ) {
    throw new Error("Refusing to remove a directory outside the test fixtures.");
  }
  fs.rmSync(root, { recursive: true, force: true });
}

export function javascript(result: BuildResult): string {
  const output = result.outputFiles?.find((file) => file.path.endsWith(".cjs"));
  if (!output) throw new Error("Missing JavaScript output");
  return output.text;
}

export function execute(code: string): unknown {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports });
  return module.exports;
}
