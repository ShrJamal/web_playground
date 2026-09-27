# Playground

Starter template for Vite Plus web projects with Tailwind CSS, TypeScript, and a full test setup.

## Setup

```sh
bun install
bun run test:install # once: downloads Chromium for browser and e2e tests
```

## Scripts

| Script                | Runs                                                  |
| --------------------- | ----------------------------------------------------- |
| `dev`                 | Dev server on http://localhost:3104                   |
| `build`               | Lint, format and type checks, then a build to `dist/` |
| `preview`             | Serves the production build                           |
| `check` / `check:fix` | Lint, format and type checks (with fixes)             |
| `test` / `test:watch` | Unit tests in Node                                    |
| `test:browser`        | Component and DOM tests in headless Chromium          |
| `test:all`            | Unit and browser tests                                |
| `test:e2e`            | E2E tests against the production build on port 4173   |

## Layout

- `src/` is the Vite root: `index.html`, `main.ts`, and styles. `@/` resolves here.
- `public/` holds static files served as-is.
- `tests/` holds unit tests; `tests/browser/` holds browser tests (Vitest).
- `e2e/` holds end-to-end tests (Playwright).

Environment variables prefixed with `PUBLIC_` are exposed to client code. Keep secrets in `.env.local` or `.env.production`, which are gitignored.
