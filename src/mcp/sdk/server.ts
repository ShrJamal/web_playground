/**
 * The transport-independent core: registries, dispatch, and one method that
 * turns a parsed JSON-RPC message into a response.
 *
 * Nothing here knows about HTTP. `handle()` is pure message-in, message-out,
 * which is what makes the protocol's statelessness visible in the code.
 */

import { RequestContext } from "./context"
import {
  INVALID_PARAMS,
  LATEST_PROTOCOL_VERSION,
  METHOD_NOT_FOUND,
  McpError,
  ResourceNotFoundError,
  SERVER_INFO_META_KEY,
  SUPPORTED_PROTOCOL_VERSIONS,
  requireProtocolMeta,
  toErrorObject,
} from "./protocol"
import { ResourceTemplate } from "./resources"
import type {
  CallToolParams,
  AuthInfo,
  Implementation,
  JsonRpcMessage,
  JsonRpcResponse,
  PromptConfig,
  PromptDefinition,
  PromptHandler,
  ResourceConfig,
  ResourceDefinition,
  ResourceReader,
  ToolConfig,
  ServerOptions,
  ToolDefinition,
  ToolHandler,
} from "./types"

const DEFAULT_LIST_TTL_MS = 300_000
const DEFAULT_DISCOVER_TTL_MS = 3_600_000

export class McpServer {
  private readonly tools = new Map<string, ToolRegistration>()
  private readonly resources = new Map<string, ResourceRegistration>()
  private readonly prompts = new Map<string, PromptRegistration>()

  constructor(
    private readonly info: Implementation,
    private readonly options: ServerOptions = {},
  ) {}

  /**
   * Register a tool: a verb the model may choose to call.
   *
   * The definition is returned verbatim from `tools/list`, so its description
   * and schema are what the model actually reads when deciding.
   */
  registerTool(name: string, config: ToolConfig, cb: ToolHandler): this {
    if (this.tools.has(name))
      throw new Error(`Tool already registered: ${name}`)

    const definition: ToolDefinition = {
      ...config,
      name,
      // A tool with no parameters still needs a schema on the wire.
      inputSchema: config.inputSchema ?? {
        type: "object",
        additionalProperties: false,
      },
    }
    this.tools.set(name, { definition, handler: cb })
    return this
  }

  /**
   * Register a resource: read-only data the application chooses to attach.
   *
   * Give it either a `uri` or a `uriTemplate`. Templates never appear in
   * `resources/list`, so register concrete URIs for anything a person should be
   * able to discover in a picker.
   */
  registerResource(
    name: string,
    uriOrTemplate: string | ResourceTemplate,
    config: ResourceConfig,
    readCallback: ResourceReader,
  ): this {
    const isTemplate = uriOrTemplate instanceof ResourceTemplate
    const key = isTemplate ? uriOrTemplate.uriTemplate : uriOrTemplate
    if (this.resources.has(key)) {
      throw new Error(`Resource already registered: ${key}`)
    }

    const definition: ResourceDefinition = {
      ...config,
      name,
      ...(isTemplate ? { uriTemplate: key } : { uri: key }),
    }
    this.resources.set(key, {
      definition,
      read: readCallback,
      ...(isTemplate ? { template: uriOrTemplate } : {}),
    })
    return this
  }

  /** Register a prompt: a message template a person invokes deliberately. */
  registerPrompt(name: string, config: PromptConfig, cb: PromptHandler): this {
    if (this.prompts.has(name)) {
      throw new Error(`Prompt already registered: ${name}`)
    }

    const { argsSchema, ...rest } = config
    const definition: PromptDefinition = {
      ...rest,
      name,
      arguments: argsSchema,
    }
    this.prompts.set(name, { definition, handler: cb })
    return this
  }

  /**
   * Answer one parsed JSON-RPC message.
   *
   * Returns null for a notification, which must never be answered. `authInfo`
   * is the verified caller when the endpoint requires authorization.
   */
  async handle(
    msg: JsonRpcMessage,
    authInfo?: AuthInfo,
  ): Promise<JsonRpcResponse | null> {
    if (msg.id === undefined || msg.id === null) return null

    try {
      const result = await this.dispatch(msg, authInfo)
      return {
        jsonrpc: "2.0",
        id: msg.id,
        // Every result declares its type and identifies the server, since the
        // client was told neither at connection time.
        result: {
          resultType: "complete",
          ...result,
          _meta: { [SERVER_INFO_META_KEY]: this.info },
        },
      }
    } catch (err) {
      return { jsonrpc: "2.0", id: msg.id, error: toErrorObject(err) }
    }
  }

  private async dispatch(
    msg: JsonRpcMessage,
    authInfo?: AuthInfo,
  ): Promise<Record<string, unknown>> {
    // A legacy client would open with `initialize`. It has no way to fall
    // forward, so name what we speak — this may be its only diagnostic.
    if (msg.method === "initialize") {
      throw new McpError(
        METHOD_NOT_FOUND,
        `This server is stateless and has no initialize handshake. Supported versions: ${LATEST_PROTOCOL_VERSION}`,
      )
    }

    // There is no handshake: every request restates version and capabilities.
    const meta = requireProtocolMeta(msg.params?._meta)
    const context = new RequestContext(msg.params ?? {}, meta, authInfo)

    switch (msg.method) {
      case "server/discover":
        return {
          supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
          capabilities: this.capabilities(),
          ...(this.options.instructions
            ? { instructions: this.options.instructions }
            : {}),
          ttlMs: this.options.discoverTtlMs ?? DEFAULT_DISCOVER_TTL_MS,
          cacheScope: "public",
        }

      case "tools/list":
        return this.cacheable({ tools: this.definitions(this.tools) })
      case "tools/call":
        return this.callTool(msg.params, context)

      case "resources/list":
        return this.cacheable({
          resources: this.definitions(this.resources).filter(
            (entry) => entry.uri,
          ),
        })
      case "resources/templates/list":
        return this.cacheable({
          resourceTemplates: this.definitions(this.resources).filter(
            (entry) => entry.uriTemplate,
          ),
        })
      case "resources/read":
        return this.readResource(msg.params?.uri, context)

      case "prompts/list":
        return this.cacheable({ prompts: this.definitions(this.prompts) })
      case "prompts/get":
        return this.getPrompt(msg.params, context)

      default:
        throw new McpError(METHOD_NOT_FOUND, `Method not found: ${msg.method}`)
    }
  }

  private async callTool(
    params: CallToolParams | undefined,
    context: RequestContext,
  ) {
    const entry = this.tools.get(params?.name ?? "")
    if (!entry)
      throw new McpError(INVALID_PARAMS, `Unknown tool: ${params?.name}`)

    return entry.handler(params?.arguments ?? {}, context) as Promise<
      Record<string, unknown>
    >
  }

  /**
   * Exact URIs win over templates. A URI matching neither is `-32602`, which
   * replaced the retired `-32002` in this revision.
   */
  private async readResource(uri: string | undefined, context: RequestContext) {
    if (!uri)
      throw new McpError(INVALID_PARAMS, "resources/read requires a uri")

    const exact = this.resources.get(uri)
    if (exact)
      return exact.read({ uri, variables: {} }, context) as Promise<
        Record<string, unknown>
      >

    for (const entry of this.resources.values()) {
      const variables = entry.template?.match(uri)
      if (variables) {
        return entry.read({ uri, variables }, context) as Promise<
          Record<string, unknown>
        >
      }
    }

    throw new ResourceNotFoundError(uri)
  }

  private async getPrompt(
    params: CallToolParams | undefined,
    context: RequestContext,
  ) {
    const entry = this.prompts.get(params?.name ?? "")
    if (!entry)
      throw new McpError(INVALID_PARAMS, `Unknown prompt: ${params?.name}`)

    const missing = (entry.definition.arguments ?? [])
      .filter(
        (argument) =>
          argument.required && params?.arguments?.[argument.name] === undefined,
      )
      .map((argument) => argument.name)
    if (missing.length) {
      throw new McpError(
        INVALID_PARAMS,
        `Missing required argument(s): ${missing.join(", ")}`,
      )
    }

    const args = (params?.arguments ?? {}) as Record<string, string>
    return entry.handler(args, context) as Promise<Record<string, unknown>>
  }

  /**
   * Advertise only what is registered: a client must not call into a capability
   * the server never declared.
   */
  private capabilities(): Record<string, unknown> {
    return {
      ...(this.tools.size ? { tools: {} } : {}),
      ...(this.resources.size ? { resources: {} } : {}),
      ...(this.prompts.size ? { prompts: {} } : {}),
    }
  }

  /** Every list result carries a freshness hint; it is what replaced polling. */
  private cacheable(body: Record<string, unknown>) {
    return {
      ...body,
      ttlMs: this.options.listTtlMs ?? DEFAULT_LIST_TTL_MS,
      cacheScope: "public",
    }
  }

  private definitions<D>(registry: Map<string, { definition: D }>): D[] {
    return [...registry.values()].map((entry) => entry.definition)
  }
}

type ToolRegistration = { definition: ToolDefinition; handler: ToolHandler }
type ResourceRegistration = {
  definition: ResourceDefinition
  read: ResourceReader
  /** Present only for templated resources; compiled once at registration. */
  template?: ResourceTemplate
}
type PromptRegistration = {
  definition: PromptDefinition
  handler: PromptHandler
}
