import "./assets/global.css"
import { Renderer } from "./renderer"
import { UI } from "./ui"

const canvas = document.getElementById("fractal-canvas") as HTMLCanvasElement
const renderer = new Renderer(canvas)
new UI(renderer)
