import tailwindcss from "@tailwindcss/vite"
import solid from "vite-plugin-solid"
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
  clearScreen: false,
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true,
    // Explicitly select polling when native filesystem events are unavailable.
    watch: {
      ignored: ["**/src-tauri/**"],
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
  },
  plugins: [solid(), tailwindcss()],
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Vitest v4 compatibility: keep separate Vite servers for inline projects.
    // Remove when plugins and config hooks can run once for shared projects.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#inline-projects-share-the-vite-server-by-default
    sharedViteServer: false,
    projects: [
      {
        // Vitest v4 compatibility: keep this inline project independent of the root config.
        // Remove to inherit root options, including plugins and setup files.
        // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
        // https://vitest.dev/guide/migration/#inline-projects-inherit-the-root-config-by-default
        extends: false,
        test: {
          // Vitest v4 compatibility: preserve mock call history.
          // Remove after tests no longer rely on calls from setup or earlier tests.
          // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
          // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
          clearMocks: false,
          name: "simulation",
          environment: "node",
          include: ["tests/*.test.ts"],
        },
      },
      {
        // Vitest v4 compatibility: keep this inline project independent of the root config.
        // Remove to inherit root options, including plugins and setup files.
        // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
        // https://vitest.dev/guide/migration/#inline-projects-inherit-the-root-config-by-default
        extends: false,
        cacheDir: process.env.VITEST_BROWSER_CACHE_DIR,
        test: {
          // Vitest v4 compatibility: preserve mock call history.
          // Remove after tests no longer rely on calls from setup or earlier tests.
          // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
          // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
          clearMocks: false,
          name: "browser",
          include: ["tests/browser/*.test.ts"],
          browser: {
            locators: {
              // Vitest v4 compatibility: keep partial, case-insensitive locator matching.
              // Remove after updating locators for full, case-sensitive matches.
              // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
              // https://vitest.dev/guide/migration/#locators-are-strict-by-default
              exact: false,
            },
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
