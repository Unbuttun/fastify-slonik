import type { Options } from "tsup";

const env = process.env.NODE_ENV;

export const tsup: Options = {
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
  format: ["cjs", "esm"],
  minify: true,
  bundle: true,
  watch: env === "development",
  skipNodeModulesBundle: true,
  entryPoints: ["src/index.ts", "src/test/index.test.ts"],
  target: "node14",
};
