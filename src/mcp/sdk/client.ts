/**
 * A request/response MCP client for revision 2026-07-28.
 *
 * The client owns everything a server author never sees: building the `_meta`
 * envelope on every request, mirroring body fields into the required headers,
 * and — the part worth reading — retrying a call when the server answers
 * `input_required` instead of a result.
 *
 * There is nothing to connect or close. Each call is one POST.
 */

import { encodeHeader, mcpName, needsNameHeader } from "./headers"
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  LATEST_PROTOCOL_VERSION,
  McpError,
  PROTOCOL_VERSION_META_KEY,
} from "./protocol"
import type {
  ClientOptions,
  DiscoverResult,
  ElicitationHandler,
  JsonRpcResponse,
  PromptDefinition,
  PromptResult,
  ResourceDefinition,
  ResourceResult,
  ToolDefinition,
  ToolResult,
} from "./types"

/** How many times a single call may be retried to satisfy `input_required`. */
const MAX_INPUT_ROUNDS = 4

export class McpClient {
  private nextId = 1

  constructor(
    private readonly url: string,
    private readonly options: ClientOptions = {},
  ) {}

  /**
   * Ask what the server supports. Optional in this revision — you may call any
   * method directly — but it is one round trip for versions, capabilities and
   * usage instructions, and the only place `instructions` is ever returned.
   */
  discover(): Promise<DiscoverResult> {
    return this.request("server/discover")
  }

  listTools(): Promise<{ tools: ToolDefinition[]; ttlMs?: number }> {
    return this.request("tools/list")
  }

  /**
   * Call a tool, satisfying any input the server asks for along the way.
   *
   * A server that needs more input answers `input_required` rather than a
   * result. The client must then gather what was asked, and retry the *whole*
   * call with a **new JSON-RPC id**, echoing `requestState` back byte for byte.
   */
  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolResult> {
    let params: Record<string, unknown> = { name, arguments: args }

    for (let round = 0; round < MAX_INPUT_ROUNDS; round++) {
      const result = await this.request<ToolResult & InputRequired>(
        "tools/call",
        params,
      )
      if (result.resultType !== "input_required") return result

      // Each retry is an independent request; the server kept no state.
      params = {
        name,
        arguments: args,
        inputResponses: await this.answer(result.inputRequests ?? {}),
        ...(result.requestState ? { requestState: result.requestState } : {}),
      }
    }

    throw new Error(
      `${name} still needs input after ${MAX_INPUT_ROUNDS} rounds`,
    )
  }

  listResources(): Promise<{
    resources: ResourceDefinition[]
    ttlMs?: number
  }> {
    return this.request("resources/list")
  }

  /** Templated resources live here, not in `listResources()`. */
  listResourceTemplates(): Promise<{
    resourceTemplates: ResourceDefinition[]
  }> {
    return this.request("resources/templates/list")
  }

  readResource(uri: string): Promise<ResourceResult> {
    return this.request("resources/read", { uri })
  }

  listPrompts(): Promise<{ prompts: PromptDefinition[]; ttlMs?: number }> {
    return this.request("prompts/list")
  }

  getPrompt(
    name: string,
    args: Record<string, string> = {},
  ): Promise<PromptResult> {
    return this.request("prompts/get", { name, arguments: args })
  }

  /**
   * One request, one POST.
   *
   * The `_meta` envelope goes on every call because there is no handshake to
   * remember it, and the headers repeat three of those fields so intermediaries
   * can route without reading the body.
   */
  async request<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = this.nextId++
    const body = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params: { ...params, _meta: this.meta() },
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headers(method, params),
      body: JSON.stringify(body),
    })

    const message = (await response.json()) as JsonRpcResponse
    if (message.error) {
      // The server's own message is the useful one. A version mismatch arrives
      // as -32022 with `data.supported` listing what it does speak, which is
      // what a client reads to retry rather than give up.
      throw new McpError(
        message.error.code,
        message.error.message,
        message.error.data,
      )
    }

    return message.result as T
  }

  /** The envelope that replaced the handshake. */
  private meta(): Record<string, unknown> {
    return {
      [PROTOCOL_VERSION_META_KEY]: this.version(),
      [CLIENT_CAPABILITIES_META_KEY]: this.options.capabilities ?? {},
      ...(this.options.clientInfo
        ? { [CLIENT_INFO_META_KEY]: this.options.clientInfo }
        : {}),
    }
  }

  private version(): string {
    return this.options.protocolVersion ?? LATEST_PROTOCOL_VERSION
  }

  private headers(
    method: string,
    params: Record<string, unknown>,
  ): Record<string, string> {
    const name = mcpName(params as { name?: string; uri?: string })

    return {
      "content-type": "application/json",
      // Both are required: the server may answer with either.
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": this.version(),
      "mcp-method": method,
      ...(needsNameHeader(method) && name
        ? { "mcp-name": encodeHeader(name) }
        : {}),
      ...(this.options.accessToken
        ? { authorization: `Bearer ${this.options.accessToken}` }
        : {}),
    }
  }

  /**
   * Turn the server's questions into answers.
   *
   * Only elicitation is supported here; a fuller client would also handle
   * `sampling/createMessage` and `roots/list`. Declining is a valid answer, and
   * the server must cope with it.
   */
  private async answer(
    requests: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const responses: Record<string, unknown> = {}

    for (const [key, request] of Object.entries(requests)) {
      const { method, params } = request as {
        method: string
        params: Record<string, unknown>
      }
      if (method !== "elicitation/create" || !this.options.onElicit) {
        responses[key] = { action: "decline" }
        continue
      }
      responses[key] = await this.options.onElicit(
        params as Parameters<ElicitationHandler>[0],
      )
    }

    return responses
  }
}

type InputRequired = {
  resultType?: string
  inputRequests?: Record<string, unknown>
  requestState?: string
}
