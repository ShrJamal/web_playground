const server = Bun.serve({
  fetch(_req: Request) {
    return new Response("Hello World!!!!")
  },
  routes: {
    "/html": Bun.file(import.meta.dir + "/index.html"),
  },
  error(err) {
    console.error(err)
  },
})

console.log("Server is running...", server.url.origin)
