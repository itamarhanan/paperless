import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `_` names a value that's deliberately left out ({ hidden: _, ...rest })
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
  {
    // Playwright fixtures hand over values with a callback named `use`, which isn't React's
    files: ["tests/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  globalIgnores([".claude/**", "test-results/**", "playwright-report/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "public/**"]),
]);
