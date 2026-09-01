import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Over-fires on the standard "fetch on mount, setState after await"
      // effect. The setState is never synchronous — it happens post-await.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Ported landing page — keep its own (working) conventions; not worth
  // relinting against this project's stricter rules for the event.
  {
    files: ["src/app/(marketing)/_landing/**"],
    rules: {
      "react/no-unescaped-entities": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
