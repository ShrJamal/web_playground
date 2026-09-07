/**
 * A minimal MCP SDK for the stateless 2026-07-28 revision, over Streamable HTTP.
 *
 * Declare what your server offers, then serve it:
 *
 * ```ts
 * const server = new McpServer({ name: "dice", version: "1.0.0" })
 * server.tool(definition, (args, context) => text("..."))
 * Bun.serve({ routes: { "/mcp": (req) => mcpFetch(req, server) } })
 * ```
 */

export { authorize, metadataPath, protectedResourceMetadata } from "./auth"
export { McpClient } from "./client"
export { RequestContext } from "./context"
export { mcpFetch } from "./http"
export { assistantMessage, userMessage } from "./prompts"
export {
  LATEST_PROTOCOL_VERSION,
  McpError,
  PROTOCOL_VERSION_META_KEY,
} from "./protocol"
export { ResourceTemplate, textResource } from "./resources"
export { text, toolError } from "./results"
export { createMcpHandler } from "./handler"
export { McpServer } from "./server"
export type {
  AuthOptions,
  ClientOptions,
  DiscoverResult,
  ElicitationHandler,
  CreateMcpHandlerOptions,
  McpHttpHandler,
  PromptConfig,
  ResourceConfig,
  ToolConfig,
  HttpOptions,
  Elicitation,
  AuthInfo,
  Implementation,
  InputRequiredResult,
  JsonRpcMessage,
  JsonRpcResponse,
  PromptDefinition,
  PromptHandler,
  PromptMessage,
  PromptResult,
  ResourceContents,
  ResourceDefinition,
  ResourceReader,
  ResourceResult,
  ServerOptions,
  ToolDefinition,
  ToolHandler,
  ToolResult,
} from "./types"
