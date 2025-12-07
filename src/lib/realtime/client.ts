/**
 * Cloudflare Workers Realtime Client
 * Solid.js hooks for WebSocket communication
 */
import { createSignal, onCleanup, onMount } from "solid-js"

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"

interface RealtimeMessage {
  event: string
  data: unknown
  channel?: string
  timestamp: number
}

interface ClientConfig {
  url: string
  autoReconnect?: boolean
  maxRetries?: number
  retryDelay?: number
}

interface UseRealtimeOptions<Events, K extends keyof Events> {
  events: K[]
  onData: (msg: { event: K; data: Events[K]; channel?: string }) => void
  onError?: (error: Error) => void
  /** Called when connected (useful for requesting history) */
  onConnect?: () => void
}

// ============================================================================
// Client Factory
// ============================================================================

/**
 * Create a typed realtime client.
 * Returns Solid.js hooks for subscribing to events.
 */
export function createRealtimeClient<Events>(config: ClientConfig) {
  const autoReconnect = config.autoReconnect ?? true
  const maxRetries = config.maxRetries ?? 5
  const retryDelay = config.retryDelay ?? 1000

  let socket: WebSocket | null = null
  let retryCount = 0
  const listeners = new Map<string, Set<(msg: RealtimeMessage) => void>>()

  const [status, setStatus] = createSignal<ConnectionStatus>("disconnected")

  // Callbacks to run on connect
  const connectCallbacks = new Set<() => void>()

  /** Connect to WebSocket server */
  function connect(): void {
    if (socket?.readyState === WebSocket.OPEN) return

    setStatus("connecting")
    socket = new WebSocket(config.url)

    socket.onopen = () => {
      retryCount = 0
      setStatus("connected")
      // Run connect callbacks
      for (const cb of connectCallbacks) cb()
    }

    socket.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as RealtimeMessage
        // biome-ignore lint/suspicious/useIterableCallbackReturn: we don't need to return a value from the callback
        listeners.get(msg.event)?.forEach((fn) => fn(msg))
      } catch {
        console.warn("Failed to parse message")
      }
    }

    socket.onclose = () => {
      setStatus("disconnected")
      if (autoReconnect && retryCount < maxRetries) {
        retryCount++
        setStatus("reconnecting")
        setTimeout(connect, retryDelay * 2 ** (retryCount - 1))
      }
    }

    socket.onerror = () => {
      console.error("WebSocket error")
    }
  }

  /** Disconnect from server */
  function disconnect(): void {
    retryCount = maxRetries // Prevent reconnect
    socket?.close()
    socket = null
    setStatus("disconnected")
  }

  /** Send a typed message to server */
  function send<K extends keyof Events & string>(
    event: K,
    data: Events[K],
    channel?: string,
  ): void {
    if (socket?.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send: not connected")
      return
    }
    socket.send(JSON.stringify({ event, data, channel, timestamp: Date.now() }))
  }

  /**
   * Solid.js hook for subscribing to events.
   * Connects on mount, cleans up on unmount.
   */
  function useRealtime<K extends keyof Events & string>(
    options: UseRealtimeOptions<Events, K>,
  ) {
    const handler = (msg: RealtimeMessage) => {
      options.onData({
        event: msg.event as K,
        data: msg.data as Events[K],
        channel: msg.channel,
      })
    }

    onMount(() => {
      // Register event listeners
      for (const event of options.events) {
        const set = listeners.get(event) ?? new Set()
        set.add(handler)
        listeners.set(event, set)
      }

      // Register connect callback
      if (options.onConnect) {
        connectCallbacks.add(options.onConnect)
        // If already connected, call immediately
        if (status() === "connected") options.onConnect()
      }

      // Connect if not already
      if (status() === "disconnected") connect()
    })

    onCleanup(() => {
      // Remove event listeners
      for (const event of options.events) {
        listeners.get(event)?.delete(handler)
      }

      // Remove connect callback
      if (options.onConnect) {
        connectCallbacks.delete(options.onConnect)
      }

      // Disconnect if no listeners remain
      const total = [...listeners.values()].reduce((n, s) => n + s.size, 0)
      if (total === 0) disconnect()
    })

    return { status }
  }

  return { useRealtime, send, connect, disconnect, status }
}
