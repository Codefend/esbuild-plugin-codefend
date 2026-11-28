import type { Plugin } from "esbuild";
import type {
  ICodefendDebugOptions,
  ICodefendTransformationOptions,
  ICodefendInternalDebugOptions,
  ICodefendInternalParserOptions,
  ICodefendInternalTransformationOptions,
} from "codefend";

export type IEsbuildCodefend = Plugin & {
  name: "esbuild-plugin-codefend";
};

export type IEsbuildCodefendOptions = {
  parser?: { name?: "codeOnly" | "startWithMAndUnderscore" };
  transformation?: ICodefendTransformationOptions;
  debug?: Omit<ICodefendDebugOptions, "ignoredWarnings">;
};

export type IEsbuildCodefendInternalOptions = {
  transformation: ICodefendInternalTransformationOptions;
  debug: ICodefendInternalDebugOptions;
  parser: ICodefendInternalParserOptions;
};
