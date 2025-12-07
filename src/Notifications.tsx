/**
 * Toast notifications component.
 * Displays real-time alerts with auto-dismiss.
 */
import { createSignal, For } from "solid-js"
import { useRealtime } from "./realtime.client"

interface Alert {
  id: number
  message: string
  timestamp: number
}

let alertId = 0

export default function Notifications() {
  const [alerts, setAlerts] = createSignal<Alert[]>([])

  // Subscribe to notification alerts
  useRealtime({
    events: ["notification.alert"],
    onData({ data }) {
      const newAlert: Alert = {
        id: ++alertId,
        message: data,
        timestamp: Date.now(),
      }
      setAlerts((prev) => [...prev, newAlert])

      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id))
      }, 5000)
    },
  })

  function dismiss(id: number) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div class="toast toast-top toast-end z-50">
      <For each={alerts()}>
        {(alert) => (
          <div class="alert alert-info shadow-lg animate-in slide-in-from-right">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              class="stroke-current shrink-0 w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{alert.message}</span>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => dismiss(alert.id)}
            >
              ✕
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
