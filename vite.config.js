import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  root: './src',
  publicDir: '../public',
  server: {
    port: 3000,
  },
  plugins: [tsconfigPaths(), tailwindcss()],
})
