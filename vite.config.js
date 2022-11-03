/// <reference types="vitest" />

import { defineConfig } from 'vite'

export default defineConfig({
  root: './src',
  define: {
    'import.meta.vitest': 'undefined',
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
