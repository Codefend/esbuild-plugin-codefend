import type { Loader } from "esbuild";

export const DEFAULT_TRANSFORMATION_PREFIX = "Ox";
export const DEFAULT_PARSER_REGEX_LIST = [
  {
    name: "main",
    regex: new RegExp("([a-zA-Z]+(_[a-zA-Z0-9]+)+)", "g"),
  },
];
export const DEFAULT_PARSER_NAME = "codeOnly";

export const JAVASCRIPT_LOADERS = new Set<Loader>(["js", "jsx", "ts", "tsx"]);

export const DEFAULT_LOADERS: Record<string, Loader | undefined> = {
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
};
