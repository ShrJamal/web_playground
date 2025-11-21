import type { Renderer } from "./renderer"

export class UI {
  renderer: Renderer
  container: HTMLElement

  constructor(renderer: Renderer) {
    this.renderer = renderer
    this.container = document.createElement("div")
    this.container.className = "absolute top-5 left-5 z-10"
    document.body.appendChild(this.container)

    this.renderControls()
  }

  renderControls() {
    const controls = document.createElement("div")
    controls.className =
      "glass-panel p-6 rounded-2xl w-72 animate-[fadeIn_0.5s_ease-out]"

    // Title
    const title = document.createElement("h1")
    title.textContent = "Fractal Explorer"
    title.className =
      "text-xl font-semibold mb-5 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent"
    controls.appendChild(title)

    // Fractal Selector
    const selectGroup = document.createElement("div")
    selectGroup.className = "mb-4"
    const label = document.createElement("label")
    label.textContent = "Fractal Type"
    label.className = "block text-sm text-gray-400 mb-2"
    const select = document.createElement("select")
    select.className =
      "w-full px-3 py-2.5 rounded-lg border border-border-glass bg-white/5 text-white text-sm transition-all hover:bg-white/10 hover:border-white/20 focus:outline-none"

    const types = [
      { value: 0, name: "Mandelbrot Set" },
      { value: 1, name: "Julia Set" },
      { value: 2, name: "Burning Ship" },
    ]

    types.forEach((type) => {
      const option = document.createElement("option")
      option.value = type.value.toString()
      option.textContent = type.name
      select.appendChild(option)
    })

    select.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement
      this.renderer.setFractalType(Number.parseInt(target.value, 10))
    })

    selectGroup.appendChild(label)
    selectGroup.appendChild(select)
    controls.appendChild(selectGroup)

    // Reset Button
    const btnGroup = document.createElement("div")
    btnGroup.className = "mb-4"
    const resetBtn = document.createElement("button")
    resetBtn.textContent = "Reset View"
    resetBtn.className =
      "w-full px-3 py-2.5 rounded-lg bg-indigo-600 text-white font-medium transition-all hover:bg-indigo-500 hover:-translate-y-px active:translate-y-0"
    resetBtn.onclick = () => {
      this.renderer.zoomCenter = { x: -0.5, y: 0 }
      this.renderer.zoomSize = 3.0
    }
    btnGroup.appendChild(resetBtn)
    controls.appendChild(btnGroup)

    // Instructions
    const instructions = document.createElement("div")
    instructions.className =
      "mt-6 pt-4 border-t border-border-glass text-xs text-gray-400"
    instructions.innerHTML = `
            <p class="mb-1 flex items-center gap-2">🖱️ Drag to Pan</p>
            <p class="flex items-center gap-2">🔍 Scroll to Zoom</p>
        `
    controls.appendChild(instructions)

    this.container.appendChild(controls)
  }
}
