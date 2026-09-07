/**
 * Header mirroring for Streamable HTTP.
 *
 * Three body fields are duplicated into HTTP headers so that load balancers,
 * gateways and WAFs can route and inspect requests without parsing the body.
 * All three are REQUIRED on every POST.
 *
 * The reason a server must check them: if a gateway routes on the header while
 * the server executes on the body, a mismatch means two components disagree
 * about what the request *is* — a privilege-escalation shape. So any
 * disagreement is rejected with `-32020`, never reconciled.
 *
 * (The spec also lets a server mirror individual tool arguments into
 * `Mcp-Param-*` via an `x-mcp-header` schema annotation. Using it is optional,
 * so this SDK does not.)
 */

import { PROTOCOL_VERSION_META_KEY } from "./protocol"
import type { JsonRpcMessage } from "./types"

/**
 * Methods whose `Mcp-Name` header carries a tool, prompt or resource name.
 *
 * Both sides read this list: the client to decide what to send, the server to
 * decide what to require. Keeping one copy is what stops them disagreeing.
 */
const NAMED_METHODS = new Set(["tools/call", "resources/read", "prompts/get"])

/** Whether this method must carry an `Mcp-Name` header. */
export function needsNameHeader(method: string | undefined): boolean {
  return method !== undefined && NAMED_METHODS.has(method)
}

/** The body field that `Mcp-Name` mirrors: a tool or prompt name, or a uri. */
export function mcpName(
  params: { name?: string; uri?: string } | undefined,
): string | undefined {
  return params?.name ?? params?.uri
}

const BASE64_PREFIX = "=?base64?"
const BASE64_SUFFIX = "?="

/**
 * Returns a description of the first mismatch, or null when every required
 * header agrees with the body.
 */
export function validateHeaders(
  headers: Headers,
  msg: JsonRpcMessage,
): string | null {
  const version = headers.get("mcp-protocol-version")
  if (!version) return "Missing MCP-Protocol-Version header"

  const bodyVersion = msg.params?._meta?.[PROTOCOL_VERSION_META_KEY]
  if (bodyVersion !== undefined && version !== bodyVersion) {
    return `MCP-Protocol-Version header '${version}' does not match body value '${bodyVersion}'`
  }

  const method = headers.get("mcp-method")
  if (!method) return "Missing Mcp-Method header"
  if (method !== msg.method) {
    return `Mcp-Method header '${method}' does not match body value '${msg.method}'`
  }

  if (needsNameHeader(msg.method)) {
    const name = headers.get("mcp-name")
    if (!name) return "Missing Mcp-Name header"

    const bodyName = mcpName(msg.params)
    if (decodeHeader(name) !== bodyName) {
      return `Mcp-Name header '${name}' does not match body value '${bodyName}'`
    }
  }

  return null
}

/**
 * A value that cannot ride in an ASCII header arrives wrapped as
 * `=?base64?…?=`, and must be decoded before it is compared to the body.
 */
export function decodeHeader(value: string): string {
  if (!value.startsWith(BASE64_PREFIX) || !value.endsWith(BASE64_SUFFIX))
    return value

  const encoded = value.slice(BASE64_PREFIX.length, -BASE64_SUFFIX.length)
  return new TextDecoder().decode(Uint8Array.fromBase64(encoded))
}

/**
 * The inverse of {@link decodeHeader}: wrap a value the transport cannot carry
 * as plain ASCII. Lives here so the encoder and decoder cannot drift apart.
 */
export function encodeHeader(value: string): string {
  const safe = /^[\x21-\x7e]+$/.test(value) && !value.startsWith(BASE64_PREFIX)
  if (safe) return value

  return `${BASE64_PREFIX}${new TextEncoder().encode(value).toBase64()}${BASE64_SUFFIX}`
}
