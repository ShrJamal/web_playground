import { createTriangle } from './triangle'
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!
const ctx = canvas.getContext('webgpu')!

async function getGPUAdapter() {
  return navigator.gpu.requestAdapter().then((a) => a?.requestDevice())
}

async function render() {
  const device = await getGPUAdapter()
  // createTriangle(device!, ctx)
}

render()

document.addEventListener('resize', () => {
  render()
})
