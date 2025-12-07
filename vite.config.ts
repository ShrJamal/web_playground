import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  publicDir: "public",
  envPrefix: "PUBLIC_",
  server: {
    port: 3000,
  },
  plugins: [tsconfigPaths(), tailwindcss(), cloudflare(), solid()],
})
