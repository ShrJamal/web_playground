import './style.css'
import * as Comlink from 'comlink'
const app = document.querySelector<HTMLDivElement>('#app')!
import Worker from './fractal.ts?worker'

if (navigator.gpu) {
  console.log('GPU is available')
} else {
  console.log('GPU is not available')
}

const canvas = document.createElement('canvas')
app.appendChild(canvas)
const ctx = canvas.getContext('2d')!
canvas.width = 500
canvas.height = 500

const maxIters = 50
let offset = [-1.5, 1.5]
let scale = (offset[1] - offset[0]) / canvas.height
let renderTime = 0

const worker = new Worker()
const remoteFunction = Comlink.wrap(worker) as any
async function renderFractal() {
  const start = performance.now()
  const res = await remoteFunction(
    canvas.width,
    offset,
    scale,
    maxIters,
    Comlink.proxy(({ x, y, rat }: { x: number; y: number; rat: number }) => {
      if (rat === 1) ctx!.fillStyle = 'black'
      else ctx!.fillStyle = `hsl(${Math.floor(rat * 300)}, ${100}%, 50%)`
      ctx!.fillRect(x, y, 1, 1)
    }),
  )
  console.log('rendered', res)
  renderTime = performance.now() - start
  console.log('render time', renderTime, 'ms')
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault()
  const re = offset[0] + e.clientX * scale
  const im = offset[1] - e.clientY * scale
  const factor = e.deltaY > 0 ? 0.9 : 1.1
  offset[0] = re + (offset[0] - re) * factor
  offset[1] = im + (offset[1] - im) * factor
  scale *= factor
  renderFractal()
})

let initPos: { x: number; y: number } | undefined
canvas.addEventListener('mousedown', (e) => {
  initPos = {
    x: e.clientX,
    y: e.clientY,
  }
})
canvas.addEventListener('mouseup', () => {
  initPos = undefined
})

canvas.addEventListener('mousemove', (e) => {
  if (!initPos) return

  offset[0] += (initPos.x - e.clientX) * scale
  offset[1] -= (initPos.y - e.clientY) * scale
  renderFractal()
})
