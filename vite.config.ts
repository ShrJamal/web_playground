import { nitro } from "nitro/vite"
import { defineConfig } from "vite-plus"

export default defineConfig({
  root: "./src",
  publicDir: "../public",
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    nitro({
      serverEntry: "server.ts",
    }),
  ],
  lint: {
    options: { typeAware: true, typeCheck: true },
    plugins: ["import", "node", "vitest", "oxc"],
    env: {
      builtin: true,
    },
    rules: {
      "no-unused-vars": ["warn"],
    },
    ignorePatterns: ["**/*.d.ts", "**/*.gen.ts", "**/*.js"],
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
    insertFinalNewline: true,
    singleAttributePerLine: true,
    sortImports: {
      newlinesBetween: false,
    },
    sortPackageJson: true,
    sortTailwindcss: {
      functions: ["clsx", "cn"],
    },
    ignorePatterns: ["**/*.d.ts", "**/*.gen.ts", "**/*.js"],
  },
  staged: {
    "*.{ts,tsx,html,css}": "vp check --fix",
  },
})
