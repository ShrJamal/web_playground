import { offset } from '@popperjs/core'
import './style.css'

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')
const ctx = canvas!.getContext('2d')
const width = canvas!.width
const height = canvas!.height
// Complex number class
class Complex {
  re: number
  im: number

  constructor(re: number, im: number) {
    this.re = re
    this.im = im
  }
  add(c: Complex) {
    return new Complex(this.re + c.re, this.im + c.im)
  }
  sub(c: Complex) {
    return new Complex(this.re - c.re, this.im - c.im)
  }
  mult(c: Complex) {
    return new Complex(
      this.re * c.re - this.im * c.im,
      this.re * c.im + this.im * c.re,
    )
  }
  abs() {
    return Math.sqrt(this.re * this.re + this.im * this.im)
  }

  belongs(iters: number) {
    let z = new Complex(0, 0)
    let i = 0
    while (z.abs() < 2 && i < iters) {
      z = z.mult(z).add(this)
      i++
    }
    return i
  }
}

// Draw the fractal
function draw2(maxIters = 100) {
  if (!canvas || !ctx) return
  const minW = 100,
    maxW = width
  const minH = 100,
    maxH = height
  const wStep = (maxW - minW) / width
  const hStep = (maxH - minH) / height
  // const minRe = 1,
  //   maxRe = 2
  // const minIm = -1,
  //   maxIm = 1
  // const reFactor = (maxRe - minRe) / width
  // const imFactor = (maxIm - minIm) / height
  // Iterate over all pixels
  console.log('Drawing...', wStep, hStep)

  for (let x = 0; x < width; x += wStep) {
    for (let y = 0; y < height; y += hStep) {
      // Check if the complex number belongs to the fractal
      const c = new Complex(x, y)

      let z = new Complex(0, 0)
      let i = 0
      while (z.abs() < 2 && i < maxIters) {
        z = z.mult(z).add(c)
        i++
      }
      if (i === maxIters) {
        ctx.fillStyle = 'black'
      } else {
        const hes = Math.floor((120 * i) / maxIters)
        ctx.fillStyle = `hsl(${hes}, 100%, 50%)`
      }
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

function draw(xOff = 0, yOff = 0, zoom = 1, iters = 100) {
  if (!ctx || !canvas) return
  ctx.clearRect(0, 0, width, height)
  const start = Date.now()
  console.log(new Complex(xOff / (width / zoom) / 4, yOff / (width / zoom) / 4))

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const re = (x - xOff) / (width / zoom)
      const im = (y - yOff) / (height / zoom)
      const c = new Complex(re, im)
      let z = new Complex(
        xOff / (width / zoom) / 100,
        yOff / (width / zoom) / 100,
      )

      let i = 0
      while (z.abs() < 2 && i < iters) {
        z = z.mult(z).add(c)
        i++
      }
      if (i === iters) {
        ctx.fillStyle = '#000'
      } else {
        ctx.fillStyle = `hsl(${(i / iters) * 360}, 100%, 50%)`
      }
      ctx.fillRect(x, y, 1, 1)
    }
  }
  console.log('Done Drawing', Date.now() - start + 'ms')
}

// Draw the fractal

let zoom = 3
draw(width / 1.5, height / 2, zoom)

canvas?.addEventListener('click', (e) => {
  draw(width - e.offsetX, height - e.offsetY, zoom)
  zoom /= 2
})

// Draw on Different iterations
// const iters = [10, 20, 50, 100, 200]
// let i = 0
// const interval = setInterval(() => {
//   draw(canvas!.width, canvas!.height, iters[i])
//   i++
//   if (i === iters.length) clearInterval(interval)
// }, 1000)
