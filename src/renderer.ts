import { fragmentShaderSource, vertexShaderSource } from "./shaders"

export class Renderer {
  canvas: HTMLCanvasElement
  gl: WebGLRenderingContext
  program: WebGLProgram

  // State
  zoomCenter: { x: number; y: number } = { x: -0.5, y: 0.0 }
  zoomSize = 3.0
  maxIterations = 500
  fractalType = 0 // 0: Mandelbrot, 1: Julia, 2: Burning Ship
  juliaC: { x: number; y: number } = { x: -0.4, y: 0.6 }

  // Interaction
  isDragging = false
  lastMouse: { x: number; y: number } = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext("webgl")
    if (!gl) throw new Error("WebGL not supported")
    this.gl = gl

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource)
    this.initBuffers()
    this.resize()

    window.addEventListener("resize", () => this.resize())
    this.setupInteractions()

    requestAnimationFrame(() => this.render())
  }

  createProgram(vsSource: string, fsSource: string): WebGLProgram {
    const vs = this.compileShader(this.gl.VERTEX_SHADER, vsSource)
    const fs = this.compileShader(this.gl.FRAGMENT_SHADER, fsSource)

    const program = this.gl.createProgram()
    if (!program) throw new Error("Failed to create program")

    this.gl.attachShader(program, vs)
    this.gl.attachShader(program, fs)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(
        `Program link error: ${this.gl.getProgramInfoLog(program)}`,
      )
    }

    return program
  }

  compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)
    if (!shader) throw new Error("Failed to create shader")

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(
        `Shader compile error: ${this.gl.getShaderInfoLog(shader)}`,
      )
    }

    return shader
  }

  initBuffers() {
    const positions = new Float32Array([
      -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0,
    ])

    const buffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW)

    const aPosition = this.gl.getAttribLocation(this.program, "a_position")
    this.gl.enableVertexAttribArray(aPosition)
    this.gl.vertexAttribPointer(aPosition, 2, this.gl.FLOAT, false, 0, 0)
  }

  resize() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  setupInteractions() {
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true
      this.lastMouse = { x: e.clientX, y: e.clientY }
    })

    window.addEventListener("mouseup", () => {
      this.isDragging = false
    })

    window.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouse.x
        const dy = e.clientY - this.lastMouse.y

        const aspect = this.canvas.width / this.canvas.height
        const scaleX = (this.zoomSize * aspect) / this.canvas.width
        const scaleY = this.zoomSize / this.canvas.height

        this.zoomCenter.x -= dx * scaleX
        this.zoomCenter.y += dy * scaleY // WebGL Y is up, screen Y is down, but we want natural drag

        this.lastMouse = { x: e.clientX, y: e.clientY }
      }
    })

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault()
        const zoomFactor = 1.1
        const zoomIn = e.deltaY < 0
        const factor = zoomIn ? 1 / zoomFactor : zoomFactor

        // Calculate mouse position in WebGL coordinates (0 to 1)
        const rect = this.canvas.getBoundingClientRect()
        const mouseX = (e.clientX - rect.left) / this.canvas.width
        const mouseY = 1.0 - (e.clientY - rect.top) / this.canvas.height // Flip Y for WebGL

        // Calculate mouse position in fractal coordinates BEFORE zoom
        const aspect = this.canvas.width / this.canvas.height
        const fractalMouseX =
          this.zoomCenter.x + (mouseX - 0.5) * this.zoomSize * aspect
        const fractalMouseY = this.zoomCenter.y + (mouseY - 0.5) * this.zoomSize

        // Apply zoom
        this.zoomSize *= factor

        // Calculate new center so that fractalMouse is still under mouseX/mouseY
        // fractalMouseX = newZoomCenter.x + (mouseX - 0.5) * newZoomSize * aspect
        // newZoomCenter.x = fractalMouseX - (mouseX - 0.5) * newZoomSize * aspect
        this.zoomCenter.x =
          fractalMouseX - (mouseX - 0.5) * this.zoomSize * aspect
        this.zoomCenter.y = fractalMouseY - (mouseY - 0.5) * this.zoomSize
      },
      { passive: false },
    )
  }

  setFractalType(type: number) {
    this.fractalType = type
    // Reset view for better experience when switching
    if (type === 1) {
      // Julia
      this.zoomCenter = { x: 0, y: 0 }
      this.zoomSize = 3.0
    } else {
      this.zoomCenter = { x: -0.5, y: 0 }
      this.zoomSize = 3.0
    }
  }

  // Helper to split a double into two 32-bit floats (high, low)
  splitDouble(value: number): [number, number] {
    const hi = Math.fround(value)
    const lo = value - hi
    return [hi, lo]
  }

  render() {
    this.gl.useProgram(this.program)

    const uResolution = this.gl.getUniformLocation(this.program, "u_resolution")
    const uZoomCenterHigh = this.gl.getUniformLocation(
      this.program,
      "u_zoomCenterHigh",
    )
    const uZoomCenterLow = this.gl.getUniformLocation(
      this.program,
      "u_zoomCenterLow",
    )
    const uZoomSizeHigh = this.gl.getUniformLocation(
      this.program,
      "u_zoomSizeHigh",
    )
    const uZoomSizeLow = this.gl.getUniformLocation(
      this.program,
      "u_zoomSizeLow",
    )
    const uMaxIterations = this.gl.getUniformLocation(
      this.program,
      "u_maxIterations",
    )
    const uFractalType = this.gl.getUniformLocation(
      this.program,
      "u_fractalType",
    )
    const uJuliaCHigh = this.gl.getUniformLocation(this.program, "u_juliaCHigh")
    const uJuliaCLow = this.gl.getUniformLocation(this.program, "u_juliaCLow")

    this.gl.uniform2f(uResolution, this.canvas.width, this.canvas.height)

    const [centerXHi, centerXLo] = this.splitDouble(this.zoomCenter.x)
    const [centerYHi, centerYLo] = this.splitDouble(this.zoomCenter.y)
    this.gl.uniform2f(uZoomCenterHigh, centerXHi, centerYHi)
    this.gl.uniform2f(uZoomCenterLow, centerXLo, centerYLo)

    const [zoomSizeHi, zoomSizeLo] = this.splitDouble(this.zoomSize)
    this.gl.uniform1f(uZoomSizeHigh, zoomSizeHi)
    this.gl.uniform1f(uZoomSizeLow, zoomSizeLo)
    this.gl.uniform1i(uMaxIterations, this.maxIterations)
    this.gl.uniform1i(uFractalType, this.fractalType)

    const [juliaCXHi, juliaCXLo] = this.splitDouble(this.juliaC.x)
    const [juliaCYHi, juliaCYLo] = this.splitDouble(this.juliaC.y)
    this.gl.uniform2f(uJuliaCHigh, juliaCXHi, juliaCYHi)
    this.gl.uniform2f(uJuliaCLow, juliaCXLo, juliaCYLo)

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    requestAnimationFrame(() => this.render())
  }
}
