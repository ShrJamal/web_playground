import { DurableObject } from "cloudflare:workers"
import crossws from "crossws/adapters/cloudflare"
import { Hono } from "hono"
import { realtimeHooks } from "../realtime.server"

const app = new Hono()

// Create crossws adapter with our typed hooks
const ws = crossws({ hooks: realtimeHooks })

app
  .get("/api/hello", (c) => c.text("Hello World"))
  .notFound((c) => c.text("Not Found", 404))

export default {
  async fetch(req, env, ctx) {
    if (req.url.includes("/api/realtime")) {
      return req.headers.get("upgrade") === "websocket"
        ? ws.handleUpgrade(req, env, ctx)
        : new Response("Expected WebSocket", { status: 426 })
    }
    return app.fetch(req, env, ctx)
  },
} satisfies ExportedHandler<Env>

export class $DurableObject extends DurableObject<Env> {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env)
    ws.handleDurableInit(this, state, env)
  }

  fetch(request: Request) {
    return ws.handleDurableUpgrade(this, request)
  }

  webSocketMessage(client: WebSocket, message: string) {
    return ws.handleDurableMessage(this, client, message)
  }

  webSocketPublish(topic: string, message: string, opts: any) {
    console.log("webSocketPublish", topic, message, opts)
    return ws.handleDurablePublish(this, topic, message, opts)
  }

  webSocketClose(
    client: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ) {
    return ws.handleDurableClose(this, client, code, reason, wasClean)
  }
}
