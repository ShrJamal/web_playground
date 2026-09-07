/**
 * OAuth 2.1 resource-server support.
 *
 * An MCP server never issues tokens. It validates the ones a client presents,
 * and tells an unauthenticated client where to go and get one. Two pieces:
 *
 * 1. A metadata document (RFC 9728) naming the authorization servers we trust.
 * 2. A `WWW-Authenticate` challenge on 401/403 pointing at that document.
 *
 * This module decides *whether* a caller may proceed. Turning a refusal into an
 * HTTP response is the transport's job, so what comes back here is a verdict,
 * not a `Response`.
 */

import type { AuthOptions, AuthVerdict } from "./types"

/**
 * Check the `Authorization` header of one request.
 *
 * Runs before the body is parsed, so an unauthenticated request never reaches a
 * tool.
 */
export async function authorize(
  req: Request,
  options: AuthOptions,
  requiredScopes: string[] = [],
): Promise<AuthVerdict> {
  const header = req.headers.get("authorization")
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : null

  // No credential at all: point the client at its authorization server, and
  // name the scopes this endpoint needs so it can ask for them up front.
  if (!token) {
    return refuse(options, 401, "Unauthorized", {
      scope: requiredScopes.join(" "),
    })
  }

  // Your verifier does the real work: signature, expiry, and — critically —
  // that this token was issued for *us*. A token minted for another service
  // must never be accepted here, and must never be forwarded onwards.
  const authInfo = await options.verify(token, options.resource)
  if (!authInfo) {
    return refuse(options, 401, "invalid_token", {
      error: "invalid_token",
      error_description:
        "The access token is expired, revoked, or issued for another resource",
    })
  }

  // Authenticated but not permitted: 403 naming every scope this operation
  // needs, so the client can step up once rather than round-trip repeatedly.
  const granted = new Set(authInfo.scopes ?? [])
  const missing = requiredScopes.filter((scope) => !granted.has(scope))
  if (missing.length) {
    return refuse(options, 403, "insufficient_scope", {
      error: "insufficient_scope",
      scope: missing.join(" "),
      error_description: `This operation requires: ${missing.join(", ")}`,
    })
  }

  return { ok: true, authInfo }
}

/**
 * The RFC 9728 metadata document. `resource` must be this server's canonical
 * URI, and `authorization_servers` must name at least one issuer.
 */
export function protectedResourceMetadata(
  options: AuthOptions,
): Record<string, unknown> {
  return {
    resource: options.resource,
    authorization_servers: options.authorizationServers,
    bearer_methods_supported: ["header"],
    ...(options.scopesSupported
      ? { scopes_supported: options.scopesSupported }
      : {}),
    ...(options.documentation
      ? { resource_documentation: options.documentation }
      : {}),
  }
}

/**
 * Where the metadata document lives, derived from the canonical resource URI:
 * an endpoint at `/mcp` publishes to `/.well-known/oauth-protected-resource/mcp`.
 */
export function metadataPath(resource: string): string {
  const { pathname } = new URL(resource)
  return pathname === "/"
    ? "/.well-known/oauth-protected-resource"
    : `/.well-known/oauth-protected-resource${pathname}`
}

/**
 * Build the `WWW-Authenticate` value. `resource_metadata` is the part clients
 * actually need: it is how they discover which authorization server to use.
 */
function refuse(
  options: AuthOptions,
  status: 401 | 403,
  message: string,
  params: Record<string, string | undefined>,
): AuthVerdict {
  const { origin } = new URL(options.resource)
  const fields = {
    resource_metadata: `${origin}${metadataPath(options.resource)}`,
    ...params,
  }

  const challenge = Object.entries(fields)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}="${value}"`)
    .join(", ")

  return { ok: false, status, message, challenge: `Bearer ${challenge}` }
}
