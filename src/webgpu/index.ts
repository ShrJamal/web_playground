import shaders from './shaders.wgsl?raw'

const maxIterations = 120
const center = [0, 0]
let zoom = 0
const scalePerZoom = 2

export async function initWebGPU() {
  console.log('initWebGPU', shaders)

  const adapter = await navigator.gpu?.requestAdapter()
  const device = await adapter?.requestDevice()

  if (!device) {
    alert('WebGPU is not supported on this device.')
    throw new Error('Your browser does not support WebGPU.')
  }

  const pixelRatio = window.devicePixelRatio
  const canvas = document.querySelector<HTMLCanvasElement>('canvas')!
  const context = canvas.getContext('webgpu')!
  const format = navigator.gpu.getPreferredCanvasFormat()
  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  })

  const uniformBufferSize =
    +2 * Float32Array.BYTES_PER_ELEMENT + // center: vec2<f32>
    2 * Float32Array.BYTES_PER_ELEMENT + // rectangle: vec2<f32>
    1 * Uint32Array.BYTES_PER_ELEMENT + // maxIterations: u32
    4

  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })

  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module: device.createShaderModule({
        code: shaders,
      }),
      entryPoint: 'vs_main',
    },
    fragment: {
      module: device.createShaderModule({
        code: shaders,
      }),
      entryPoint: 'fs_main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-strip',
    },
  })

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  })

  {
    const resize = () => {
      canvas.width = canvas.clientWidth * pixelRatio
      canvas.height = canvas.clientHeight * pixelRatio
    }
    resize()
    window.addEventListener('resize', resize)
  }

  // {
  //   const rangeInput = document.querySelector('.max-iterations input[type=range]')
  //   const updateMaxIterations = () => {
  //     maxIterations = /** @type {any} */ document.querySelector(
  //       '#max-iterations',
  //     ).textContent = 2 ** rangeInput.valueAsNumber
  //   }
  //   rangeInput?.addEventListener('input', updateMaxIterations)
  //   updateMaxIterations()
  // }

  {
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const pointX =
          ((e.offsetX / canvas.width) * 2 - 1) /
            (scalePerZoom ** zoom / (canvas.width / canvas.height)) +
          center[0]

        const pointY =
          -((e.offsetY / canvas.height) * 2 - 1) / scalePerZoom ** zoom +
          center[1]

        const delta = -Math.min(Math.max(-e.deltaY * 5, -100), 100) / 100
        zoom += delta
        center[0] = pointX - (pointX - center[0]) / scalePerZoom ** delta
        center[1] = pointY - (pointY - center[1]) / scalePerZoom ** delta
      },
      { passive: false },
    )

    canvas.addEventListener('mousemove', (e) => {
      if (!(e.buttons & 0b001)) return
      center[0] +=
        -((e.movementX / canvas.width) * 2) /
        (scalePerZoom ** zoom / (canvas.width / canvas.height))
      center[1] += ((e.movementY / canvas.height) * 2) / scalePerZoom ** zoom
    })
  }

  function renderFractal() {
    const arrayBuffer = new ArrayBuffer(uniformBufferSize)
    new Float32Array(arrayBuffer, 0).set([
      ...center,
      (scalePerZoom ** -zoom * canvas.width) / canvas.height,
      scalePerZoom ** -zoom,
    ])
    new Uint32Array(arrayBuffer, (2 + 2) * Float32Array.BYTES_PER_ELEMENT).set([
      maxIterations,
    ])
    device.queue.writeBuffer(uniformBuffer, 0, arrayBuffer)

    const encoder = device.createCommandEncoder()
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: [0, 0, 0, 0],
          storeOp: 'store',
        },
      ],
    })

    renderPass.setPipeline(pipeline)
    renderPass.setBindGroup(0, bindGroup)
    renderPass.draw(4)
    renderPass.end()
    device.queue.submit([encoder.finish()])
    window.requestAnimationFrame(renderFractal)
  }
  window.requestAnimationFrame(renderFractal)
}
