/**
 * Streamable HTTP: the transport for MCP revision 2026-07-28.
 *
 * One POST-only endpoint. No sessions, no `Mcp-Session-Id`, no standalone GET
 * stream, no `Last-Event-ID` resumability — all removed in this revision.
 *
 * Every request is answered with a single JSON body. The spec also permits an
 * SSE response, which is how progress notifications and `subscriptions/listen`
 * are delivered; this SDK serves neither, so it never needs to stream. Clients
 * re-fetch lists when `ttlMs` expires instead of subscribing — which is exactly
 * why those cache hints exist.
 *
 * This layer only speaks HTTP. Deciding what a message *means* belongs to
 * `McpServer`; deciding who may call belongs to `auth.ts`. Both hand back
 * values that this file renders.
 */

import { authorize } from "./auth"
import { validateHeaders } from "./headers"
import {
  HEADER_MISMATCH,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  UNSUPPORTED_PROTOCOL_VERSION,
} from "./protocol"
import type { McpServer } from "./server"
import type { AuthInfo, HttpOptions, JsonRpcMessage } from "./types"

/**
 * Which HTTP status carries which JSON-RPC error.
 *
 * An unimplemented method is a 404 whose *body* proves the endpoint exists —
 * that is how a client tells it apart from a wrong URL. Everything else the
 * protocol rejects is a 400.
 */
const STATUS_FOR_CODE = new Map([
  [METHOD_NOT_FOUND, 404],
  [UNSUPPORTED_PROTOCOL_VERSION, 400],
  [HEADER_MISMATCH, 400],
])

/**
 * Answer one request to the MCP endpoint.
 *
 * `build` is called only once a request has passed the gates, so a probe, a
 * scan or an unauthenticated caller never costs a server instance.
 *
 * Checks run in the order an attacker meets them: method, origin,
 * authorization, content negotiation, then the body.
 */
export async function mcpFetch(
  req: Request,
  build: () => McpServer,
  options: HttpOptions = {},
): Promise<Response> {
  // GET and DELETE were the session and standalone-stream mechanics of older
  // revisions. Answering 405 is how an old client learns they are gone.
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 })

  // DNS rebinding: a browser cannot forge Origin, so an unexpected one means a
  // web page is talking to us.
  const origin = req.headers.get("origin")
  if (origin !== null && !(options.allowedOrigins ?? []).includes(origin)) {
    return errorResponse(403, null, INVALID_REQUEST, "Origin not allowed")
  }

  // Credentials are per-request input, never connection state — which is also
  // what lets tools/list legitimately vary by the caller's scopes.
  let authInfo: AuthInfo | undefined
  if (options.auth) {
    const verdict = await authorize(req, options.auth, options.requiredScopes)
    if (!verdict.ok) {
      return errorResponse(
        verdict.status,
        null,
        INVALID_REQUEST,
        verdict.message,
        {
          "www-authenticate": verdict.challenge,
        },
      )
    }
    authInfo = verdict.authInfo
  }

  const accept = req.headers.get("accept") ?? ""
  if (
    !accepts(accept, "application/json") ||
    !accepts(accept, "text/event-stream")
  ) {
    const detail = "Accept must list application/json and text/event-stream"
    return errorResponse(406, null, INVALID_REQUEST, detail)
  }

  let msg: JsonRpcMessage
  try {
    msg = await req.json()
  } catch {
    return errorResponse(400, null, PARSE_ERROR, "Parse error")
  }

  // Headers mirror body fields so intermediaries can route without parsing. If
  // they disagree, one of them is lying.
  const mismatch = validateHeaders(req.headers, msg)
  if (mismatch)
    return errorResponse(400, msg.id ?? null, HEADER_MISMATCH, mismatch)

  // From here the core owns the outcome, including rejecting a protocol version
  // we do not speak — that surfaces below as -32022, and so as a 400.
  const response = await build().handle(msg, authInfo)

  // A notification is accepted with no body.
  if (!response) return new Response(null, { status: 202 })

  const status = response.error
    ? (STATUS_FOR_CODE.get(response.error.code) ?? 400)
    : 200
  return json(status, response)
}

function accepts(accept: string, type: string): boolean {
  return accept.includes(type) || accept.includes("*/*")
}

/** Every failure leaves through here, so they all look the same on the wire. */
function errorResponse(
  status: number,
  id: string | number | null,
  code: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return json(
    status,
    { jsonrpc: "2.0" as const, id, error: { code, message } },
    headers,
  )
}

function json(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}
