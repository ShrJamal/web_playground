import { createSignal } from "solid-js"

export default function App() {
  const [count, setCount] = createSignal(0)

  return (
    <div class="h-full flex flex-col items-center justify-center gap-8">
      <h1 class="text-5xl font-bold">Solid + Nitro Playground</h1>
      <button
        class="btn btn-primary"
        type="button"
        onClick={() => setCount((count) => count + 1)}
      >
        Count: {count()}
      </button>

      <button
        type="button"
        onClick={() => fetch("/api/hello")}
      >
        Call API
      </button>
    </div>
  )
}
