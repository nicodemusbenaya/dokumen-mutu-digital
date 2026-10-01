import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Output kompilasi parser untuk skrip import (dibangun ulang on-demand):
    "scripts/.parser-build/**",
    // Skrip audit/pengujian sementara:
    "_tmp_*",
  ]),
]);

export default eslintConfig;
