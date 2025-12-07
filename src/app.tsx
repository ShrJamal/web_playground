import { createSignal } from "solid-js"
import ChatRoom from "./ChatRoom"
import Notifications from "./Notifications"
import { send } from "./realtime.client"

export default function App() {
  const [alertCount, setAlertCount] = createSignal(0)

  /** Broadcast a notification to all connected clients */
  function broadcastAlert() {
    setAlertCount((c) => c + 1)
    send("notification.alert", `🔔 Broadcast #${alertCount()}`)
  }

  return (
    <div class="min-h-screen bg-base-300 flex flex-col">
      {/* Toast notifications (positioned fixed) */}
      <Notifications />

      {/* Header */}
      <header class="navbar bg-base-100 shadow-sm">
        <div class="flex-1">
          <span class="text-xl font-bold px-4">⚡ Realtime Chat</span>
        </div>
        <div class="flex-none px-4">
          <button
            type="button"
            class="btn btn-ghost btn-sm gap-2"
            onClick={broadcastAlert}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="w-4 h-4"
            >
              <path d="M5.85 3.5a.75.75 0 0 0-1.117-1 9.719 9.719 0 0 0-2.348 4.876.75.75 0 0 0 1.479.248A8.219 8.219 0 0 1 5.85 3.5ZM19.267 2.5a.75.75 0 1 0-1.118 1 8.22 8.22 0 0 1 1.987 4.124.75.75 0 0 0 1.48-.248A9.72 9.72 0 0 0 19.266 2.5Z" />
              <path
                fill-rule="evenodd"
                d="M12 2.25A6.75 6.75 0 0 0 5.25 9v.75a8.217 8.217 0 0 1-2.119 5.52.75.75 0 0 0 .298 1.206c1.544.57 3.16.99 4.831 1.243a3.75 3.75 0 1 0 7.48 0 24.583 24.583 0 0 0 4.83-1.244.75.75 0 0 0 .298-1.205 8.217 8.217 0 0 1-2.118-5.52V9A6.75 6.75 0 0 0 12 2.25ZM9.75 18c0-.034 0-.067.002-.1a25.05 25.05 0 0 0 4.496 0l.002.1a2.25 2.25 0 1 1-4.5 0Z"
                clip-rule="evenodd"
              />
            </svg>
            Broadcast Alert
          </button>
        </div>
      </header>

      {/* Main content */}
      <main class="flex-1 flex items-center justify-center p-4">
        <ChatRoom />
      </main>

      {/* Footer */}
      <footer class="footer footer-center p-4 bg-base-100 text-base-content text-sm opacity-60">
        <p>
          Built with Solid.js + Hono + Cloudflare Workers — Open multiple tabs
          to test!
        </p>
      </footer>
    </div>
  )
}
