import { readFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { buildRuntimeOptions, obfuscate, stats } from "codefend";
import { DEFAULT_LOADERS, JAVASCRIPT_LOADERS } from "./data/Constants";
import type { IEsbuildCodefend, IEsbuildCodefendOptions } from "./data/Types";
import { OptionsBuilder } from "./options/OptionsBuilder";

export type { IEsbuildCodefend, IEsbuildCodefendOptions } from "./data/Types";

export const codefend = (options?: IEsbuildCodefendOptions): IEsbuildCodefend => {
  const name = "esbuild-plugin-codefend";
  const ___options = new OptionsBuilder(name).setOptions(options ?? {}).build();

  return {
    name,
    setup(build): void {
      if (build.initialOptions.stdin) {
        throw new Error(`${name} requires file entry points; stdin input is not supported.`);
      }

      // Each build context owns its mapping; rebuilds start with fresh names and statistics.
      let runtimeOptions = buildRuntimeOptions();
      build.onStart(() => {
        runtimeOptions = buildRuntimeOptions();
      });

      build.onLoad({ filter: /.*/, namespace: "file" }, async ({ path }) => {
        const extension = extname(path);
        const loader = build.initialOptions.loader?.[extension] ?? DEFAULT_LOADERS[extension];
        if (!loader || !JAVASCRIPT_LOADERS.has(loader)) return;

        const source = await readFile(path, "utf8");
        // Codefend restarts pool allocation on each call, so reserve names already used by other modules.
        const usedNames = new Set(Object.values(runtimeOptions.map));
        const transformation = {
          ...___options.transformation,
          pool: ___options.transformation.pool.filter((word) => !usedNames.has(word)),
        };
        const contents = obfuscate(source, transformation, ___options.parser, runtimeOptions);

        return { contents, loader, resolveDir: dirname(path), watchFiles: [path] };
      });

      build.onEnd((result) => {
        if (result.errors.length === 0) stats({ stats: ___options.debug.stats }, runtimeOptions);
      });
    },
  };
};
