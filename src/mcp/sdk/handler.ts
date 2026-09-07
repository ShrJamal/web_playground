/**
 * The serving entry, mirroring `createMcpHandler` from the official SDK.
 *
 * It takes a *factory*, not a server instance: one fresh `McpServer` per HTTP
 * request, holding nothing between them. That is statelessness made visible —
 * any instance of your process can answer any request, so scaling is ordinary
 * round-robin with no sticky sessions.
 *
 * This is also the only place that knows about HTTP deployment: the endpoint's
 * origins, its authorization, and the well-known document that advertises it.
 * `McpServer` itself stays a registry plus `handle()`.
 */

import { metadataPath, protectedResourceMetadata } from "./auth"
import { mcpFetch } from "./http"
import type { McpServer } from "./server"
import type { CreateMcpHandlerOptions, McpHttpHandler } from "./types"

/**
 * Build a web-standard handler for one MCP endpoint.
 *
 * ```ts
 * const handler = createMcpHandler(() => {
 *   const server = new McpServer({ name: "dice", version: "1.0.0" })
 *   server.registerTool("roll_dice", { description, inputSchema }, cb)
 *   return server
 * })
 *
 * Bun.serve({
 *   routes: { "/mcp": handler.fetch, ...handler.wellKnownRoutes() },
 * })
 * ```
 *
 * `fetch` is a bound arrow property, so it can be detached
 * (`const { fetch } = handler`) without losing its binding.
 */
export function createMcpHandler(
  factory: () => McpServer,
  options: CreateMcpHandlerOptions = {},
): McpHttpHandler {
  return {
    fetch: (request: Request) => mcpFetch(request, factory, options),

    // Nothing is held between requests, so there is nothing to tear down. The
    // method exists because callers expect the shape.
    close: async () => {},

    wellKnownRoutes: () => {
      const auth = options.auth
      if (!auth) return {}

      // Unauthenticated by definition: this is how a client with no token finds
      // out where to get one.
      const document = protectedResourceMetadata(auth)
      return { [metadataPath(auth.resource)]: () => Response.json(document) }
    },
  }
}
