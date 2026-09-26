import { createSignal } from "solid-js"

export default function App() {
  const [count, setCount] = createSignal(0)

  return (
    <main class="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center text-slate-100">
      <h1 class="text-3xl font-semibold">Tauri + SolidJS</h1>
      <p class="text-slate-400">Web Playground is ready.</p>
      <button
        class="rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 hover:bg-sky-400"
        onClick={() => setCount((value) => value + 1)}
        type="button"
      >
        Count: {count()}
      </button>
    </main>
  )
}
