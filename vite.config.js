/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  root: './src',
  server: {
    port: 3000,
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
