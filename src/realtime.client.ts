/**
 * Shared realtime client instance.
 * Import to use useRealtime hook and send events.
 */
import { createRealtimeClient } from "./lib/realtime/index"
import type { RealtimeEvents } from "./realtime.server"

// WebSocket URL (auto-detects protocol and host)
const url =
  typeof window !== "undefined"
    ? `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/realtime`
    : "ws://localhost:3000/api/realtime"

// Shared client instance
export const { useRealtime, send, status, connect, disconnect } =
  createRealtimeClient<RealtimeEvents>({ url })
