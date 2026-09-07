/**
 * Builders for what a tool handler returns.
 */

import type { ToolResult } from "./types"

/** A successful result. Pass `structured` to also return machine-readable output. */
export function text(message: string, structured?: unknown): ToolResult {
  return {
    content: [{ type: "text", text: message }],
    ...(structured === undefined ? {} : { structuredContent: structured }),
  }
}

/**
 * A tool failure — an API being down, a value out of range.
 *
 * Deliberately *not* a protocol error: the model sees this text and can correct
 * itself. Reserve `McpError` for unknown tools, malformed requests and faults.
 */
export function toolError(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}
