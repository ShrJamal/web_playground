import { defineConfig } from 'vite'
import tsConfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  root: './src',
  publicDir: '../public',
  server: {
    port: 3000,
  },
  plugins: [tsConfigPaths()],

})
