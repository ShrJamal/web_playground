import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite-plus"
import { playwright } from "vite-plus/test/browser-playwright"
import { preview } from "vite-plus/test/browser-preview"

const manualBrowser = process.env.VITEST_MANUAL_BROWSER === "true"
const IGNORE_PATTERNS = ["dist/**", "public/**", "bun.lock"]
// Vite Plus runs development, production builds, tests, linting, and formatting from this config.
export default defineConfig({
  root: "./src",
  publicDir: "../public",
  envPrefix: "PUBLIC_",
  cacheDir: process.env.VITE_CACHE_DIR,
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    // Explicitly select polling when native filesystem events are unavailable.
    watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === "true" },
  },
  plugins: [tailwindcss()],
  test: {
    projects: [
      { test: { name: "simulation", environment: "node", include: ["tests/*.test.ts"] } },
      {
        cacheDir: process.env.VITEST_BROWSER_CACHE_DIR,
        test: {
          name: "browser",
          include: ["tests/browser/*.test.ts"],
          browser: {
            enabled: true,
            provider: manualBrowser ? manualProvider() : playwright(),
            headless: !manualBrowser,
            ui: false,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
  lint: {
    ignorePatterns: IGNORE_PATTERNS,
    rules: { "typescript/no-explicit-any": "error" },
    categories: {
      correctness: "error",
    },
    env: {
      browser: true,
    },
    overrides: [
      {
        files: ["tests/**/*.ts", "vite.config.ts"],
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

// Manual runs use an existing browser when a host cannot launch a headless process.
function manualProvider() {
  const definition = preview()
  const factory = definition.providerFactory
  definition.providerFactory = function create(project) {
    const provider = factory(project)
    const open = provider.openPage.bind(provider)
    provider.openPage = async function openPage(sessionId, url, options) {
      console.info(`Open the Vitest run: ${url}`)
      await open(sessionId, url, options)
    }
    return provider
  }
  return definition
}
