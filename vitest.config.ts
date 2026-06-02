import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    // Test file patterns
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],

    // Exclude node_modules and build output
    exclude: ["node_modules", "build", "coverage"],

    // Use jsdom for UI component tests, node for services
    environment: "node",

    // Setup file for global mocks
    setupFiles: ["src/__tests__/setup.ts"],

    // TypeScript configuration
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    pool: "forks",
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json", "html", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/__tests__/**",
        "src/main.ts", // Figma entry point
        "src/ui.tsx", // UI entry point
        "**/*.d.ts",
        "**/types.ts",
      ],

      // Coverage thresholds (adjust as needed)
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },

    // Timeout for slow tests
    testTimeout: 5000,
    hookTimeout: 10000,

    // Reporter configuration
    reporters: ["default"],

    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,
  },

  // Resolve aliases to match tsconfig paths
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
