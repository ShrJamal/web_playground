/**
 * Type-safe realtime server using crossws
 * Provides Zod validation and full type inference
 */
import { defineHooks, type Peer } from "crossws"
import type { z } from "zod/v4"

// ============================================================================
// Types
// ============================================================================

type EventSchemaMap = Record<string, z.ZodType>
export type RealtimeSchema = Record<string, EventSchemaMap>

/** Message format over the wire */
export interface RealtimeMessage<T = unknown> {
  event: string
  data: T
  channel?: string
  ts: number
}

/** Flatten "namespace.event" keys */
type FlattenKeys<S extends RealtimeSchema> = {
  [N in keyof S & string]: `${N}.${keyof S[N] & string}`
}[keyof S & string]

/** Infer payload types from schema */
export type InferEvents<S extends RealtimeSchema> = {
  [K in FlattenKeys<S>]: K extends `${infer N}.${infer E}`
    ? N extends keyof S
      ? E extends keyof S[N]
        ? z.infer<S[N][E]>
        : never
      : never
    : never
}

/** Typed message context - discriminated union for each event */
type MessageContext<S extends RealtimeSchema> = {
  [K in FlattenKeys<S>]: {
    peer: Peer
    event: K
    data: InferEvents<S>[K]
    channel?: string
    /** Publish this message to subscribers */
    publish: (topic?: string) => void
    /** Send to specific peer */
    sendTo: (peerId: string) => void
  }
}[FlattenKeys<S>]

// ============================================================================
// Realtime Hooks
// ============================================================================

interface RealtimeHooks<S extends RealtimeSchema> {
  /** Called when a validated message is received (fully typed) */
  onMessage?: (ctx: MessageContext<S>) => void
  /** Called when a peer connects */
  onOpen?: (peer: Peer) => void
  /** Called when a peer disconnects */
  onClose?: (peer: Peer) => void
  /** Called on error */
  onError?: (peer: Peer, error: Error) => void
}

interface RealtimeOptions<S extends RealtimeSchema> {
  schema: S
  hooks?: RealtimeHooks<S>
  /** Store messages for history (requires Durable Object storage) */
  storeMessages?: boolean
  /** Max messages to keep in history per channel */
  maxHistory?: number
}

// Message storage for history (in-memory, or use DO storage)
const messageHistory = new Map<string, RealtimeMessage[]>()

/**
 * Create typed crossws hooks with Zod validation.
 * Use with: crossws({ hooks: createRealtimeHooks(...) })
 */
export function createRealtimeHooks<S extends RealtimeSchema>(
  options: RealtimeOptions<S>,
) {
  type EventKey = FlattenKeys<S>
  type Events = InferEvents<S>

  const storeMessages = options.storeMessages ?? false
  const maxHistory = options.maxHistory ?? 100

  // Build validator map
  const validators = new Map<string, z.ZodType>()
  for (const [ns, events] of Object.entries(options.schema)) {
    for (const [name, validator] of Object.entries(events)) {
      validators.set(`${ns}.${name}`, validator)
    }
  }

  /** Validate and parse incoming message */
  function parseMessage(raw: string): RealtimeMessage | null {
    try {
      const msg = JSON.parse(raw) as RealtimeMessage
      const validator = validators.get(msg.event)
      if (!validator) {
        console.warn(`Unknown event: ${msg.event}`)
        return null
      }
      const result = validator.safeParse(msg.data)
      if (!result.success) {
        console.warn(`Invalid payload for ${msg.event}`)
        return null
      }
      return { ...msg, data: result.data }
    } catch {
      return null
    }
  }

  /** Store message in history */
  function storeMessage(channel: string, msg: RealtimeMessage): void {
    if (!storeMessages) return
    const history = messageHistory.get(channel) ?? []
    history.push(msg)
    if (history.length > maxHistory) history.shift()
    messageHistory.set(channel, history)
  }

  /** Get message history for a channel */
  function getHistory(channel: string): RealtimeMessage[] {
    return messageHistory.get(channel) ?? []
  }

  /** Create validated message for sending */
  function emit<K extends EventKey>(
    event: K,
    data: Events[K],
    channel?: string,
  ): RealtimeMessage<Events[K]> {
    const validator = validators.get(event)
    if (!validator) throw new Error(`Unknown event: ${event}`)

    const result = validator.safeParse(data)
    if (!result.success) throw new Error(`Invalid payload: ${result.error}`)

    return {
      event,
      data: result.data as Events[K],
      channel,
      ts: Date.now(),
    }
  }

  /** Serialize message for sending */
  function serialize(msg: RealtimeMessage): string {
    return JSON.stringify(msg)
  }

  // Peer map for sendTo functionality
  const peers = new Map<string, Peer>()

  // crossws hooks
  const hooks = defineHooks({
    open(peer: Peer) {
      peers.set(peer.id, peer)
      // Subscribe to global channel by default
      peer.subscribe("$global")
      options.hooks?.onOpen?.(peer)
    },

    message(peer: Peer, message: { text: () => string }) {
      const raw = message.text()
      const msg = parseMessage(raw)
      if (!msg) return

      const channel = msg.channel ?? "$global"

      // Store in history if enabled
      storeMessage(channel, msg)

      // Auto-publish to channel
      peer.publish(channel, raw)

      // Call user hook with full typing
      options.hooks?.onMessage?.({
        peer,
        event: msg.event as EventKey,
        data: msg.data as Events[EventKey],
        channel: msg.channel,
        publish: (topic = channel) => peer.publish(topic, raw),
        sendTo: (peerId) => peers.get(peerId)?.send(raw),
      } as MessageContext<S>)
    },

    close(peer: Peer) {
      peers.delete(peer.id)
      options.hooks?.onClose?.(peer)
    },

    error(peer: Peer, error: Error) {
      options.hooks?.onError?.(peer, error)
    },
  })

  return {
    ...hooks,
    /** Create and serialize a typed message */
    emit,
    /** Serialize a message for sending */
    serialize,
    /** Get message history for a channel */
    getHistory,
    /** Get all connected peers */
    getPeers: () => peers,
  }
}
