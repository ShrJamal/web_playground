const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
  <h1>Hello WebGPU!</h1>
  ${
    navigator.gpu
      ? '<p>WebGPU is supported!</p>'
      : '<p>WebGPU is not supported!</p>'
  }
`
