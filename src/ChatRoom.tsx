/**
 * Beautiful chat room with real-time messaging.
 * Uses WebSocket for bidirectional, low-latency communication.
 */
import { createEffect, createSignal, For } from "solid-js"
import { send, status, useRealtime } from "./realtime.client"

interface ChatMessage {
  userId: string
  content: string
  timestamp: number
}

// Generate random user ID for this session
const userId = `user-${Math.random().toString(36).slice(2, 8)}`

// Generate avatar color from user ID
function getUserColor(id: string): string {
  const colors = [
    "bg-primary",
    "bg-secondary",
    "bg-accent",
    "bg-info",
    "bg-success",
    "bg-warning",
    "bg-error",
  ]
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

// Get user initials from ID
function getInitials(id: string): string {
  return id.slice(0, 2).toUpperCase()
}

// Format timestamp
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ChatRoom() {
  const [messages, setMessages] = createSignal<ChatMessage[]>([])
  const [typingUsers, setTypingUsers] = createSignal<Set<string>>(new Set())
  const [input, setInput] = createSignal("")
  let messagesContainer: HTMLDivElement | undefined
  let typingTimeout: ReturnType<typeof setTimeout> | undefined

  // Subscribe to chat message events and request history on connect
  useRealtime({
    events: ["chat.message"],
    onData({ data }) {
      // Avoid duplicates when receiving history
      setMessages((prev) => {
        const exists = prev.some(
          (m) => m.userId === data.userId && m.timestamp === data.timestamp,
        )
        return exists ? prev : [...prev, data]
      })
    },
    onConnect() {
      // Request message history when connected
      send("chat.history", { channel: "$global" })
    },
  })

  // Subscribe to typing indicator events
  useRealtime({
    events: ["chat.typing"],
    onData({ data }) {
      if (data.userId === userId) return // Ignore own typing
      setTypingUsers((prev) => {
        const next = new Set(prev)
        if (data.isTyping) {
          next.add(data.userId)
        } else {
          next.delete(data.userId)
        }
        return next
      })
    },
  })

  // Auto-scroll to bottom when new messages arrive
  createEffect(() => {
    messages()
    messagesContainer?.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: "smooth",
    })
  })

  function handleSend(): void {
    const content = input().trim()
    if (!content) return

    setMessages((prev) => [
      ...prev,
      {
        userId,
        content,
        timestamp: Date.now(),
      },
    ])
    send("chat.message", {
      userId,
      content,
      timestamp: Date.now(),
    })

    setInput("")
    handleTyping(false)
  }

  function handleTyping(isTyping: boolean): void {
    // Debounce typing indicator
    if (typingTimeout) clearTimeout(typingTimeout)

    send("chat.typing", { userId, isTyping })

    // Auto-stop typing after 2 seconds of inactivity
    if (isTyping) {
      typingTimeout = setTimeout(() => {
        send("chat.typing", { userId, isTyping: false })
      }, 2000)
    }
  }

  function handleInput(e: InputEvent): void {
    const target = e.currentTarget as HTMLInputElement
    setInput(target.value)
    if (target.value) handleTyping(true)
  }

  // Connection status badge color
  const statusColor = () => {
    switch (status()) {
      case "connected":
        return "badge-success"
      case "connecting":
      case "reconnecting":
        return "badge-warning"
      default:
        return "badge-error"
    }
  }

  return (
    <div class="card bg-base-200 shadow-xl w-full max-w-md">
      {/* Header */}
      <div class="card-body p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="avatar placeholder">
              <div
                class={`${getUserColor(userId)} text-neutral-content w-10 rounded-full flex items-center justify-center`}
              >
                <div class="text-sm font-bold ">{getInitials(userId)}</div>
              </div>
            </div>
            <div>
              <h2 class="card-title text-lg">Chat Room</h2>
              <p class="text-xs opacity-60">You are {userId}</p>
            </div>
          </div>
          <div class={`badge ${statusColor()} gap-1`}>
            <span class="w-2 h-2 rounded-full bg-current animate-pulse" />
            {status()}
          </div>
        </div>
      </div>

      <div class="divider my-0 px-4" />

      {/* Messages */}
      <div
        ref={messagesContainer}
        class="flex flex-col gap-3 p-4 h-80 overflow-y-auto scroll-smooth"
      >
        {messages().length === 0 && (
          <div class="flex-1 flex items-center justify-center">
            <p class="text-base-content/40 text-sm">
              No messages yet. Start the conversation!
            </p>
          </div>
        )}

        <For each={messages()}>
          {(msg) => {
            const isOwn = msg.userId === userId
            return (
              <div class={`chat ${isOwn ? "chat-end" : "chat-start"}`}>
                <div class="chat-image avatar placeholder">
                  <div
                    class={`${getUserColor(msg.userId)} text-neutral-content w-8 rounded-full`}
                  >
                    <span class="text-xs">{getInitials(msg.userId)}</span>
                  </div>
                </div>
                <div class="chat-header text-xs opacity-50 mb-1">
                  {isOwn ? "You" : msg.userId}
                  <time class="ml-1">{formatTime(msg.timestamp)}</time>
                </div>
                <div
                  class={`chat-bubble ${isOwn ? "chat-bubble-primary" : ""}`}
                >
                  {msg.content}
                </div>
              </div>
            )
          }}
        </For>

        {/* Typing indicator */}
        {typingUsers().size > 0 && (
          <div class="chat chat-start">
            <div class="chat-image avatar placeholder">
              <div class="bg-base-300 w-8 rounded-full">
                <span class="text-xs">...</span>
              </div>
            </div>
            <div class="chat-bubble bg-base-300 text-base-content">
              <span class="loading loading-dots loading-sm" />
            </div>
          </div>
        )}
      </div>

      <div class="divider my-0 px-4" />

      {/* Input */}
      <div class="p-4">
        <div class="join w-full">
          <input
            type="text"
            value={input()}
            onInput={handleInput}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            class="input input-bordered join-item flex-1 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input().trim()}
            class="btn btn-primary join-item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="w-5 h-5"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
