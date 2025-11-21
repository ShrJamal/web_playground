import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  server: {
    port: 3000,
  },
  root: "src",
  publicDir: "../public",
  plugins: [tsConfigPaths(), tailwindcss()],
})
