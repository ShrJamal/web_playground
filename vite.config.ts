import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite-plus"
import { playwright } from "vite-plus/test/browser-playwright"

const IGNORE_PATTERNS = ["dist/**", "public/**", "bun.lock"]
// Vite Plus runs development, production builds, tests, linting, and formatting from this config.
export default defineConfig({
  root: "./src",
  publicDir: "../public",
  envPrefix: "PUBLIC_",
  cacheDir: process.env.VITE_CACHE_DIR,
  server: {
    host: "0.0.0.0",
    port: 3104,
    // strictPort: true,
  },
  plugins: [tailwindcss()],
  test: {
    // Test files live in the repo-root tests/ folder, outside the Vite root (./src).
    passWithNoTests: true,
    projects: [
      { test: { name: "unit", environment: "node", include: ["../tests/*.test.ts"] } },
      {
        test: {
          name: "browser",
          include: ["../tests/browser/*.test.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  lint: {
    ignorePatterns: IGNORE_PATTERNS,
    options: { typeAware: true, typeCheck: true },
    plugins: ["typescript", "import", "promise"],
    rules: { "typescript/no-explicit-any": "error" },
    env: {
      browser: true,
    },
    overrides: [
      {
        files: ["tests/*.ts", "e2e/**/*.ts", "vite.config.ts", "playwright.config.ts"],
        env: { node: true },
      },
    ],
  },
  fmt: {
    semi: false,
    singleAttributePerLine: true,
    sortImports: {
      newlinesBetween: false,
    },
    sortTailwindcss: {
      functions: ["cn"],
    },
    ignorePatterns: IGNORE_PATTERNS,
  },
  staged: {
    "*.{ts,tsx,html,css}": "vp check --fix",
  },
})
