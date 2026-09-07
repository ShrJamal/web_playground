import { officialFetch } from "./mcp-official/server"
import { auth } from "./mcp/auth-config"
import { createMcpHandler } from "./mcp/sdk"
import { mcpServer } from "./mcp/server"

const GUIDES_DIR = new URL("./guides/", import.meta.url).pathname

const GUIDE_PAGES: Record<string, string> = {
  "/guides": "index.html",
  "/guides/architecture": "architecture.html",
  "/guides/requests": "requests.html",
  "/guides/primitives": "primitives.html",
  "/guides/build": "build.html",
  "/guides/http": "http.html",
  "/guides/debug": "debug.html",
  "/guides/faq": "faq.html",
}

// One fresh server per request, exactly as the official SDK does it. Ours is
// declared once at module load, so the factory just hands it back.
const mcp = createMcpHandler(() => mcpServer, { auth })

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 3001),
  fetch(req: Request) {
    const { pathname } = new URL(req.url)
    const page = GUIDE_PAGES[pathname.replace(/\/$/, "")]
    if (page) return new Response(Bun.file(GUIDES_DIR + page))
    return new Response("Not found", { status: 404 })
  },
  routes: {
    "/": () => Response.redirect("/guides", 302),
    "/health": () => new Response("OK"),
    "/favicon.svg": () => new Response(Bun.file("public/favicon.svg")),
    "/guides/style.css": () => new Response(Bun.file(`${GUIDES_DIR}style.css`)),
    "/mcp": mcp.fetch,
    ...mcp.wellKnownRoutes(),
    // The same dice server on the official SDK, for comparison.
    "/official-mcp": (req) => officialFetch(req),
  },
  error(err) {
    console.error(err)
  },
})

console.log("Server is running...", server.url.origin)
