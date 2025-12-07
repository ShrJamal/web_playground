import { Hono } from "hono"
import { upgradeWebSocket } from "hono/cloudflare-workers"

const app = new Hono()

app
  // .get("/", (c) => c.text("Hello World"))
  .get("/api/hello", (c) => c.text("Hello World from API"))
  .use(
    "/api/ws",
    upgradeWebSocket((_c) => {
      return {
        onOpen: () => {
          console.log("WebSocket connected")
        },
        onMessage: (ev) => {
          console.log("WebSocket message received", ev.data)
        },
        onClose: () => {
          console.log("WebSocket closed")
        },
        onError: (_, error) => {
          console.error("WebSocket error", error)
        },
      }
    }),
  )
  .notFound((c) => c.text("Not Found", 404))

export default {
  async fetch(req) {
    return app.fetch(req)
  },
} satisfies ExportedHandler<Env>
