import { createSignal } from "solid-js"
import viteLogo from "/vite.svg"

export default function App() {
  const [count, setCount] = createSignal(0)

  return (
    <div class="flex-1 flex flex-col gap-4 items-center justify-center">
      <img
        class="size-50"
        src={viteLogo}
        alt="Vite logo"
      />
      <h1 class="text-4xl font-bold">Cloudflare + Vite + Solid</h1>
      <button
        class="btn btn-primary"
        onClick={() => {
          setCount((p) => p + 1)
        }}
        type="button"
      >
        count is {count()}
      </button>
    </div>
  )
}
