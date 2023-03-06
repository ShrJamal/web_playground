import { fractalFragmentShaderText, vertexShaderText } from './shaders'

export type RenderOptions = {
  max_iters: number
  scale: number
  offset: [number, number]
  c: { re: number; im: number }
  update: boolean
  tintColor: number[]
  colorFrequency: number
  fps: number
}

export function fractal(canvas: HTMLCanvasElement, ops: RenderOptions) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true })!
  // Clear
  gl.clearColor(0.1, 0.1, 0.1, 1.0)
  gl.clear(gl.COLOR_BUFFER_BIT)

  // Compile shaders
  function compileVertexShaders() {
    const shader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(shader, vertexShaderText)
    gl.compileShader(shader)
    return shader
  }
  function compileFragmentShaders() {
    const shader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(shader, fractalFragmentShaderText)
    gl.compileShader(shader)
    return shader
  }

  // Verts for the quad
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1,
      -1, // bottom left corner
      -1,
      1, // top left corner
      1,
      1, // top right corner
      1,
      -1, // bottom right corner
    ]),
    gl.STATIC_DRAW,
  )

  // indices for the quad
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(
    gl.ELEMENT_ARRAY_BUFFER,
    new Uint16Array([
      0,
      1,
      2, // first triangle
      0,
      2,
      3, // second triangle
    ]),
    gl.STATIC_DRAW,
  )

  // Attach shaders
  const program = gl.createProgram()!
  gl.attachShader(program, compileVertexShaders())
  gl.attachShader(program, compileFragmentShaders())
  gl.linkProgram(program)
  gl.useProgram(program)

  // Color
  program.color = gl.getUniformLocation(program, 'color')
  gl.uniform4fv(program.color, ops.tintColor)

  // Position
  program.position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(program.position)
  gl.vertexAttribPointer(program.position, 2, gl.FLOAT, false, 0, 0)

  // Uniforms
  const timeUniformLocation = gl.getUniformLocation(program, 'time')
  const iterationUniformLocation = gl.getUniformLocation(program, 'iters')
  const scaleUniformLocation = gl.getUniformLocation(program, 'scale')
  const offsetUniformLocation = gl.getUniformLocation(program, 'offset')
  const cUniformLocation = gl.getUniformLocation(program, 'c')
  const colorFrequencyUniformLocation = gl.getUniformLocation(
    program,
    'color_frequency',
  )

  function setUniforms() {
    gl.uniform1f(iterationUniformLocation, ops.max_iters)
    gl.uniform1f(scaleUniformLocation, ops.scale)
    gl.uniform2fv(offsetUniformLocation, ops.offset)
    gl.uniform1f(cUniformLocation, ops.c)
    gl.uniform1f(colorFrequencyUniformLocation, ops.colorFrequency)
    gl.uniform4fv(program.color, ops.tintColor)
  }

  let prev_time: any
  let elapsed_frames = 0
  function animate(t?: any) {
    prev_time ??= t
    const delta = t - prev_time
    ops.fps = 1000.0 / delta
    prev_time = t

    elapsed_frames += 1
    if (elapsed_frames % 10 == 0) {
      elapsed_frames = elapsed_frames % 100
    }

    gl.uniform1f(timeUniformLocation, t / 1000)
    gl.clear(gl.COLOR_BUFFER_BIT)
    setUniforms()
    // gl.drawArrays(gl.TRIANGLE_STRIP, 0, triangleVerts.length / 2);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0)
    requestAnimationFrame(animate)
  }
  animate()

  function uiLoop() {
    const factorX = (0.05 * ops.offset[0] * 1.0) / (10.0 * ops.scale)
    ops.offset[0] += factorX

    const factorY = (0.05 * ops.offset[1] * 1.0) / (10.0 * ops.scale)
    ops.offset[1] += factorY

    // requestAnimationFrame(uiLoop)
  }
  uiLoop()
}
