/**
 * Protocol constants and errors for MCP revision 2026-07-28.
 *
 * This revision is stateless: there is no `initialize` handshake and no session.
 * Every request restates its protocol version and the client's capabilities in
 * `params._meta`, so any server instance can answer any request.
 */

import type { Implementation, ProtocolMeta } from "./types"

/** The newest revision this SDK speaks. Reported by `server/discover`. */
export const LATEST_PROTOCOL_VERSION = "2026-07-28"

/** Every revision this SDK will serve, newest first. */
export const SUPPORTED_PROTOCOL_VERSIONS = [LATEST_PROTOCOL_VERSION]

/** Reserved `_meta` prefix. Any key under it is defined by the spec. */
const META = "io.modelcontextprotocol"

/** Required on every request: the revision the client is speaking. */
export const PROTOCOL_VERSION_META_KEY = `${META}/protocolVersion`
/** Required on every request: what the client can do, e.g. `{ elicitation: {} }`. */
export const CLIENT_CAPABILITIES_META_KEY = `${META}/clientCapabilities`
/** Optional on every request: the client's name and version, for logs only. */
export const CLIENT_INFO_META_KEY = `${META}/clientInfo`
/** Set by us on every result, so the client can identify us without a handshake. */
export const SERVER_INFO_META_KEY = `${META}/serverInfo`

// JSON-RPC error codes. -32020..-32099 is reserved for the MCP specification;
// never invent a code in that range. Note that a *tool* failure is not an error
// at all — it is an ordinary result with `isError: true`.

/** Body was not valid JSON. */
export const PARSE_ERROR = -32700
/** Not a valid JSON-RPC object. */
export const INVALID_REQUEST = -32600
/** Unknown method. Over HTTP this is a 404 whose body proves the endpoint exists. */
export const METHOD_NOT_FOUND = -32601
/** Missing `_meta`, unknown tool, unknown resource, missing prompt argument. */
export const INVALID_PARAMS = -32602
/** A handler threw. */
export const INTERNAL_ERROR = -32603
/** An HTTP header disagrees with the request body. */
export const HEADER_MISMATCH = -32020
/** The request needs a client capability that was not declared. */
export const MISSING_REQUIRED_CLIENT_CAPABILITY = -32021
/** The version in `_meta` is one this server does not speak. */
export const UNSUPPORTED_PROTOCOL_VERSION = -32022

/**
 * Thrown for genuine protocol errors only.
 *
 * If the model could fix the problem by calling differently — a bad argument, an
 * out-of-range value — return `toolError()` instead so it can read the reason.
 */
export class McpError extends Error {
  constructor(
    readonly code: number,
    message: string,
    /** Extra detail placed on `error.data`, e.g. the versions we do support. */
    readonly data?: unknown,
  ) {
    super(message)
  }
}

/** The client asked for a revision this server does not implement. */
export class UnsupportedProtocolVersionError extends McpError {
  constructor(requested: string) {
    super(UNSUPPORTED_PROTOCOL_VERSION, "Unsupported protocol version", {
      supported: SUPPORTED_PROTOCOL_VERSIONS,
      requested,
    })
  }
}

/** The request needs a capability the client never declared. */
export class MissingRequiredClientCapabilityError extends McpError {
  constructor(...requiredCapabilities: string[]) {
    super(
      MISSING_REQUIRED_CLIENT_CAPABILITY,
      "Client is missing a required capability",
      {
        requiredCapabilities,
      },
    )
  }
}

/** No resource is registered at that uri, and no template matches it. */
export class ResourceNotFoundError extends McpError {
  constructor(uri: string) {
    super(INVALID_PARAMS, `Resource not found: ${uri}`, { uri })
  }
}

/**
 * Validate the per-request metadata that replaced the handshake.
 *
 * Throws `-32602` when the required keys are absent and `-32022` — carrying the
 * versions we do speak — when the client asks for one we do not.
 */
export function requireProtocolMeta(
  meta: Record<string, unknown> | undefined,
): ProtocolMeta {
  const version = meta?.[PROTOCOL_VERSION_META_KEY]
  const capabilities = meta?.[CLIENT_CAPABILITIES_META_KEY]

  if (typeof version !== "string" || capabilities === undefined) {
    throw new McpError(
      INVALID_PARAMS,
      `_meta must carry ${PROTOCOL_VERSION_META_KEY} and ${CLIENT_CAPABILITIES_META_KEY}`,
    )
  }
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
    throw new UnsupportedProtocolVersionError(version)
  }

  return {
    version,
    capabilities: capabilities as Record<string, unknown>,
    clientInfo: meta?.[CLIENT_INFO_META_KEY] as Implementation | undefined,
  }
}

/** Map any thrown value onto a JSON-RPC error object. */
export function toErrorObject(err: unknown) {
  if (err instanceof McpError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.data ? { data: err.data } : {}),
    }
  }
  return { code: INTERNAL_ERROR, message: String((err as Error).message) }
}
