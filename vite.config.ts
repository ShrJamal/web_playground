import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  root: "./src",
  publicDir: "../public",
  server: {
    port: 3000,
  },
  plugins: [tailwindcss()],
  lint: {
    options: { typeAware: true, typeCheck: true },
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    plugins: ["import", "node", "vitest"],
    env: {
      builtin: true,
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-unused-vars": [
        "warn",
        // {
        //   fix: {
        //     imports: "safe-fix",
        //   },
        // },
      ],
    },
    ignorePatterns: [
      "**/*.d.ts",
      "**/*.gen.ts",
      "**/public/**",
      "**/*.js",
      "bun.lock",
    ],
  },
  fmt: {
    useTabs: false,
    tabWidth: 2,
    printWidth: 80,
    singleQuote: false,
    jsxSingleQuote: false,
    quoteProps: "as-needed",
    trailingComma: "all",
    semi: false,
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    singleAttributePerLine: true,
    ignorePatterns: [
      "**/*.d.ts",
      "**/*.gen.ts",
      "**/public/**",
      "**/*.js",
      "bun.lock",
    ],
  },
  staged: {
    "*.{ts,tsx,html,css}": "vp check --fix",
  },
})
