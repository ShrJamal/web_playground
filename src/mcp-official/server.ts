// The same dice server, on the official @modelcontextprotocol/server v2 SDK.
// Kept beside our hand-built one so the two can be compared on the wire.

import {
  McpServer,
  createMcpHandler,
  isLegacyRequest,
  legacyStatelessFallback,
} from "@modelcontextprotocol/server"
import { z } from "zod"

// The factory runs once per request: one fresh server, no state between calls.
function build() {
  const server = new McpServer({ name: "dice-official", version: "1.0.0" })

  server.registerTool(
    "roll_dice",
    {
      title: "Roll dice",
      description:
        "Roll N dice with S sides each and return the rolls and their total.",
      inputSchema: z.object({
        count: z.number().int().min(1).max(100).default(1),
        sides: z.number().int().min(2).max(1000).default(6),
      }),
    },
    async ({ count, sides }) => {
      const rolls = Array.from(
        { length: count },
        () => 1 + Math.floor(Math.random() * sides),
      )
      const total = rolls.reduce((sum, roll) => sum + roll, 0)
      return {
        content: [
          {
            type: "text",
            text: `Rolled ${count}d${sides}: ${rolls.join(", ")} (total ${total})`,
          },
        ],
        structuredContent: { rolls, total },
      }
    },
  )

  return server
}

const modern = createMcpHandler(build)
const legacy = legacyStatelessFallback(build)

// Same factory, two wire protocols: the tools are written once.
// Note legacyStatelessFallback() returns the fetch function itself, while
// createMcpHandler() returns { fetch, notify, bus, close }.
export async function officialFetch(req: Request): Promise<Response> {
  return (await isLegacyRequest(req)) ? legacy(req) : modern.fetch(req)
}
