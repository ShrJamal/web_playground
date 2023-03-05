import { expose } from 'comlink'

function mandelbrot(maxIters: number, c: [number, number]) {
  let z = { re: 0, im: 0 }
  for (var i = 0; i < maxIters && z.re * z.re + z.im * z.im <= 4; i++) {
    z = {
      re: z.re * z.re - z.im * z.im + c[0],
      im: 2 * z.re * z.im + c[1],
    }
  }
  return i / maxIters
}

function renderFractal(
  size: number,
  offset: [number, number],
  scale: number,
  maxIters: number,
  cb: any,
) {
  for (let x = 0; x < size; x++) {
    const re = offset[0] + x * scale
    for (let y = 0; y < size; y++) {
      const im = offset[1] - y * scale
      const rat = mandelbrot(maxIters, [re, im])
      cb({ x, y, rat })
    }
  }
}

expose(renderFractal)
