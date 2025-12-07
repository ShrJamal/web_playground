/**
 * Realtime server configuration.
 * Defines typed event schema and exports types for client.
 */
import { z } from "zod/v4"
import { createRealtimeHooks, type InferEvents } from "./lib/realtime"

// Event schema
const schema = {
  notification: {
    alert: z.string(),
    badge: z.object({
      count: z.number(),
      type: z.enum(["info", "warning", "error"]),
    }),
  },
  chat: {
    message: z.object({
      userId: z.string(),
      content: z.string(),
      timestamp: z.number(),
    }),
    typing: z.object({
      userId: z.string(),
      isTyping: z.boolean(),
    }),
    // Request history when client connects
    history: z.object({
      channel: z.string(),
    }),
  },
}

// Create crossws hooks with validation and history
export const realtimeHooks = createRealtimeHooks({
  schema,
  storeMessages: true,
  maxHistory: 50,
  hooks: {
    onOpen(peer) {
      console.log(`[realtime] connected: ${peer.id}`)
    },
    onMessage({ peer, event, data }) {
      // ctx.data is now fully typed based on ctx.event!
      // console.log(`[realtime] ${ctx.peer.id} → ${ctx.event}:`, ctx.data)

      // Handle history request
      if (event === "chat.history") {
        // ctx.data is typed as { channel: string }
        const history = realtimeHooks.getHistory(data.channel)
        for (const msg of history) {
          peer.send(realtimeHooks.serialize(msg))
        }
      }
    },
    onClose(peer) {
      console.log(`[realtime] disconnected: ${peer.id}`)
    },
    onError(peer, error) {
      console.error(`[realtime] error: ${peer.id}`, error)
    },
  },
})

// Export event types for client
export type RealtimeEvents = InferEvents<typeof schema>
