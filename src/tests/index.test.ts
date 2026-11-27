import { describe, expect, it } from "vitest";
import type { Plugin } from "esbuild";
import { codefend, type IEsbuildCodefendOptions } from "..";
import { DEFAULT_PARSER_REGEX_LIST, DEFAULT_TRANSFORMATION_PREFIX } from "../data/Constants";
import { OptionsBuilder } from "../options/OptionsBuilder";

describe("Plugin configuration", () => {
  it("provides a native esbuild plugin with no unsupported properties", () => {
    const plugin: Plugin = codefend();

    expect(plugin.name).toBe("esbuild-plugin-codefend");
    expect(Object.keys(plugin).sort()).toEqual(["name", "setup"]);
  });

  it("uses the shared Codefend defaults", () => {
    const options = new OptionsBuilder("esbuild-plugin-codefend").setOptions({}).build();

    expect(options.transformation.prefix).toBe(DEFAULT_TRANSFORMATION_PREFIX);
    expect(options.transformation.ignore).toEqual([]);
    expect(options.transformation.static).toEqual([]);
    expect(options.debug.stats).toBe(true);
    expect(options.parser.regexList).toEqual(DEFAULT_PARSER_REGEX_LIST);
  });

  it.each([
    { options: { debug: { stats: "yes" } }, property: /stats/ },
    { options: { transformation: { prefix: 42 } }, property: /prefix/ },
    { options: { transformation: { ignore: "l_value" } }, property: /ignore/ },
    { options: { transformation: { pool: [42] } }, property: /pool/ },
    { options: { transformation: { static: [{ from: "l_value" }] } }, property: /to/ },
    { options: { transformation: null }, property: /transformation/ },
    { options: { debug: { ignoredWarnings: [] } }, property: /ignoredWarnings/ },
    { options: { unknown: true }, property: /unknown/ },
  ])("rejects invalid options through schema-utils: $options", ({ options, property }) => {
    const create = () => codefend(options as unknown as IEsbuildCodefendOptions);

    expect(create).toThrowError(expect.objectContaining({ name: "ValidationError" }));
    expect(create).toThrowError(property);
    expect(create).toThrowError(/esbuild-plugin-codefend/);
  });
});
