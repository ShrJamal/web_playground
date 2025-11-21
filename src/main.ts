import "./assets/style.css"

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="flex flex-col items-center justify-center gap-8">
    <h1 class="text-5xl">Vite Playground</h1>
    <div class="card">
      <button class="btn btn-primary" id="counter" type="button">Count is 0</button>
    </div>
    <div class="card">
      <button class="btn btn-primary" id="counter" type="button">Count is 0</button>
    </div>
  </div>
`

const btn = document.querySelector<HTMLButtonElement>("#counter")!

let counter = 0
btn.addEventListener("click", () => {
  counter++
  btn.innerHTML = `Count is ${counter}`
})
