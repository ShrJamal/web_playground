import { Hono } from "hono"

const app = new Hono()

app
  .get("/api/hello", (c) => c.text("Hello World"))
  .notFound((c) => c.text("Not Found", 404))

export default {
  async fetch(req) {
    return app.fetch(req)
  },
} satisfies ExportedHandler<Env>
