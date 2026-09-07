/**
 * Shared types. Nothing here has behaviour; the runtime pieces live alongside.
 */

import type { RequestContext } from "./context"

/** Self-reported name and version. For display and logs — never for security. */
export type Implementation = { name: string; version: string }

export type ServerOptions = {
  /**
   * Natural-language guidance about the server as a whole, returned only by
   * `server/discover`. Clients may prepend it to the system prompt — or never
   * fetch it, since discovery is optional. Anything a tool truly needs belongs
   * in that tool's own description.
   */
  instructions?: string
  /** Freshness hint on list results, in ms. This is what replaced polling. */
  listTtlMs?: number
  /** Freshness hint on `server/discover`, in ms. */
  discoverTtlMs?: number
}

// ---------------------------------------------------------------- primitives

/**
 * Everything about a tool except its name, which is the first argument to
 * `registerTool()`. All of this is prompt input — the model picks tools from the
 * description and schema alone.
 */
export type ToolConfig = {
  /** Human-readable label for UIs. */
  title?: string
  /** Say what it does, when to use it, when not to, and what comes back. */
  description?: string
  /**
   * JSON Schema 2020-12. Use `{ type: "object", additionalProperties: false }`
   * for a tool with no parameters.
   *
   * The official SDK takes a Zod schema here and derives this; keeping the SDK
   * dependency-free means writing the schema out.
   */
  inputSchema?: Record<string, unknown>
  /** Optional schema constraining `structuredContent`. */
  outputSchema?: Record<string, unknown>
  /** Untrusted hints — `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. */
  annotations?: Record<string, boolean>
  /** Icons for display in user interfaces. */
  icons?: { src: string; mimeType?: string; sizes?: string[] }[]
  /** Passed through to the tool entry in `tools/list`. */
  _meta?: Record<string, unknown>
}

/** A tool as it appears on the wire, in `tools/list`. */
export type ToolDefinition = ToolConfig & {
  name: string
  inputSchema: Record<string, unknown>
}

/** What a tool returns on success or on a failure the model can correct. */
export type ToolResult = {
  content: { type: "text"; text: string }[]
  /** Machine-readable output, conforming to `outputSchema` when one is declared. */
  structuredContent?: unknown
  /** True for a tool failure. Not a protocol error — the model reads and retries. */
  isError?: boolean
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: RequestContext,
) =>
  | ToolResult
  | InputRequiredResult
  | Promise<ToolResult | InputRequiredResult>

/**
 * Everything about a resource except its name and address, which are the first
 * two arguments to `registerResource()`.
 */
export type ResourceConfig = {
  title?: string
  description?: string
  mimeType?: string
  /** Freshness hint for this resource's reads, in ms. */
  cacheHint?: { ttlMs?: number; cacheScope?: "public" | "private" }
  _meta?: Record<string, unknown>
}

/** A resource as it appears on the wire. Carries either `uri` or `uriTemplate`. */
export type ResourceDefinition = ResourceConfig & {
  name: string
  /** An exact uri. Only these appear in `resources/list`. */
  uri?: string
  /** An RFC 6570 pattern. Only these appear in `resources/templates/list`. */
  uriTemplate?: string
}

export type ResourceContents = {
  uri: string
  mimeType?: string
  text?: string
  /** Base64, for binary contents. */
  blob?: string
}

export type ResourceResult = { contents: ResourceContents[] }

/** `variables` holds whatever the `uriTemplate` captured; empty for an exact URI. */
export type ResourceReader = (
  request: { uri: string; variables: Record<string, string> },
  context: RequestContext,
) =>
  | ResourceResult
  | InputRequiredResult
  | Promise<ResourceResult | InputRequiredResult>

/** Prompt arguments are plain strings — there is no JSON Schema here. */
export type PromptArgument = {
  name: string
  description?: string
  required?: boolean
}

/**
 * A prompt: a saved message with holes in it, invoked deliberately by a person.
 * What you return is *input* to the model, not an answer shown to the user.
 */
export type PromptDefinition = {
  name: string
  title?: string
  description?: string
  arguments?: PromptArgument[]
}

export type PromptMessage = {
  role: "user" | "assistant"
  content: { type: "text"; text: string }
}

export type PromptResult = {
  /** Shown in the client's menu. Only `messages` reach the model. */
  description?: string
  messages: PromptMessage[]
}

/**
 * Everything about a prompt except its name.
 *
 * The official SDK calls this `argsSchema` and takes a Zod object; this takes
 * the wire form directly.
 */
export type PromptConfig = {
  title?: string
  description?: string
  argsSchema?: PromptArgument[]
  icons?: { src: string; mimeType?: string; sizes?: string[] }[]
  _meta?: Record<string, unknown>
}

export type PromptHandler = (
  args: Record<string, string>,
  context: RequestContext,
) =>
  | PromptResult
  | InputRequiredResult
  | Promise<PromptResult | InputRequiredResult>

// ---------------------------------------------------------------------- MRTR

/**
 * A multi round-trip request: the server needs input before it can finish.
 * The request ends here; the client gathers the input and retries the whole
 * call with `inputResponses` and this `requestState`.
 */
export type InputRequiredResult = {
  resultType: "input_required"
  /** Keyed server-to-client requests: `elicitation/create`, `sampling/createMessage`, `roots/list`. */
  inputRequests: Record<string, unknown>
  /** Opaque to the client. Sign it if it influences authorization or logic. */
  requestState: string
}

export type Elicitation = {
  message: string
  /** JSON Schema for the form the user fills in. */
  schema: Record<string, unknown>
  /** Overrides the default `requestState`, which is the elicitation key. */
  state?: string
}

// ------------------------------------------------------------------ protocol

export type JsonRpcMessage = {
  jsonrpc: "2.0"
  id?: string | number | null
  method?: string
  params?: any
}

export type JsonRpcResponse = {
  jsonrpc: "2.0"
  id: string | number
  result?: Record<string, unknown>
  error?: { code: number; message: string; data?: unknown }
}

/** What the request itself told us. There is no session to consult. */
export type ProtocolMeta = {
  version: string
  capabilities: Record<string, unknown>
  clientInfo?: Implementation
}

/** Shared shape of `tools/call`, `resources/read` and `prompts/get` params. */
export type CallToolParams = {
  name?: string
  uri?: string
  arguments?: Record<string, unknown>
  inputResponses?: Record<string, { action?: string; content?: unknown }>
  requestState?: string
}

// ---------------------------------------------------------------------- auth

/** Who the caller is, as established by verifying their access token. */
export type AuthInfo = {
  /** Stable identifier for the principal, e.g. the token's `sub`. */
  subject: string
  /** Scopes the token actually carries. */
  scopes?: string[]
  /** Anything else your verifier wants handlers to see. */
  claims?: Record<string, unknown>
}

/** Options for {@link createMcpHandler}. Same knobs as the transport itself. */
export type CreateMcpHandlerOptions = HttpOptions

/**
 * The handler returned by {@link createMcpHandler}.
 *
 * `fetch` is a bound arrow property, so it can be detached
 * (`const { fetch } = handler`) and still work.
 */
export type McpHttpHandler = {
  fetch: (request: Request) => Promise<Response>
  close: () => Promise<void>
  /** The RFC 9728 routes to spread into a route table. Empty without auth. */
  wellKnownRoutes: () => Record<string, () => Response>
}

export type HttpOptions = {
  /** Origins allowed to call this endpoint from a browser. Empty rejects all. */
  allowedOrigins?: string[]
  /** Omit to leave the endpoint unauthenticated — only sane on a loopback bind. */
  auth?: AuthOptions
  /** Scopes every request must carry. Per-tool checks belong in the handler. */
  requiredScopes?: string[]
}

export type AuthOptions = {
  /**
   * This server's canonical URI, e.g. `https://mcp.example.com/mcp`. Tokens must
   * be issued for exactly this audience.
   */
  resource: string
  /** Issuers whose tokens we accept. At least one, per RFC 9728. */
  authorizationServers: string[]
  /** Advertised in the metadata document as the minimal useful scope set. */
  scopesSupported?: string[]
  /** Link for humans, surfaced in the metadata document. */
  documentation?: string
  /**
   * Validate a token and return the caller, or null to reject.
   *
   * Must check the signature, expiry, and that the audience is `resource`.
   * Accepting a token minted for another service is the confused-deputy bug
   * the spec forbids.
   */
  verify: (
    token: string,
    resource: string,
  ) => Promise<AuthInfo | null> | AuthInfo | null
}

/**
 * Either the caller passed, or here is why not — as data, so the transport can
 * render it the same way it renders every other refusal.
 */
export type AuthVerdict =
  | { ok: true; authInfo: AuthInfo }
  | { ok: false; status: 401 | 403; message: string; challenge: string }

// -------------------------------------------------------------------- client

export type ClientOptions = {
  /** Sent as `clientInfo` on every request. Display and logs only. */
  clientInfo?: Implementation
  /** What this client can do, e.g. `{ elicitation: {} }`. Servers check it. */
  capabilities?: Record<string, unknown>
  /** Override the revision to speak — useful for exercising `-32022`. */
  protocolVersion?: string
  /** Bearer token for an endpoint that requires authorization. */
  accessToken?: string
  /** Called when a server asks the user a question mid-call. */
  onElicit?: ElicitationHandler
}

/**
 * Answers one `elicitation/create` request. Returning `decline` or `cancel` is
 * always valid — a server may not assume the user cooperates.
 */
export type ElicitationHandler = (request: {
  message: string
  requestedSchema: Record<string, unknown>
}) =>
  | Promise<{ action: "accept" | "decline" | "cancel"; content?: unknown }>
  | { action: "accept" | "decline" | "cancel"; content?: unknown }

export type DiscoverResult = {
  supportedVersions: string[]
  capabilities: Record<string, unknown>
  instructions?: string
  ttlMs?: number
  cacheScope?: string
}
