import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import figmaPlugin from "@figma/eslint-plugin-figma-plugins";
import vitest from "@vitest/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  // 1. Global Ignores
  {
    ignores: [
      "node_modules/**",
      "build/**",
      "coverage/**",
      "eslint.config.mjs",
      "signals-example.tsx",
      "debug-server.js",
      "vitest.config.ts",
    ],
  },

  // 2. Base JS Rules
  eslint.configs.recommended,

  // 3. Base TS Rules (Global)
  ...tseslint.configs.recommendedTypeChecked,

  // 4. MAIN CONFIG (Applies to source AND tests)
  // Since tests end in .ts/.tsx, they inherit everything here automatically.
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@figma/figma-plugins": figmaPlugin,
    },
    rules: {
      // Figma plugin rules
      "@figma/figma-plugins/await-requires-async": "error",
      "@figma/figma-plugins/ban-deprecated-id-params": "error",
      "@figma/figma-plugins/ban-deprecated-sync-methods": "error",
      "@figma/figma-plugins/ban-deprecated-sync-prop-getters": "error",
      "@figma/figma-plugins/ban-deprecated-sync-prop-setters": "error",
      "@figma/figma-plugins/dynamic-page-documentchange-event-advice": "warn",
      "@figma/figma-plugins/dynamic-page-find-method-advice": "warn",
      "@figma/figma-plugins/constrain-proportions-replaced-by-target-aspect-ratio-advice": "warn",

      // Custom rules (recommended by figma-plugins, but not part of the "recommended" set)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      
      // Prevent direct crypto.randomUUID usage - use generateRequestId utility instead
      // crypto.randomUUID is unavailable in Figma's sandboxed iframe environment
      "no-restricted-properties": [
        "error",
        {
          object: "crypto",
          property: "randomUUID",
          message: "Use generateRequestId() from 'src/utils/generate-request-id' instead. crypto.randomUUID is unavailable in Figma's iframe.",
        },
      ],
    },
  },

  // 5. TEST OVERRIDES (Applies ONLY to tests)
  // This layers ON TOP of the Main Config above.
  {
    files: ["**/__tests__/**/*", "**/*.test.ts", "**/*.test.tsx"],
    plugins: {
      vitest,
    },
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    rules: {
      // Add Vitest Rules
      ...vitest.configs.recommended.rules,

      // --- RELAXATIONS ---
      // We turn OFF strict rules that make mocking hard
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off",

      // Test-specific safety
      "no-restricted-globals": [
        "error",
        {
          name: "global",
          message: "Use globalThis instead of global in tests.",
        },
      ],
    },
  },

  // 6. Prettier (Must be last to override formatting rules)
  eslintConfigPrettier,
]);