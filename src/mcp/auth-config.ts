/**
 * Authorization for the MCP endpoint.
 *
 * Enabled only when MCP_AUTH_ISSUER is set, so `bun dev` stays open on loopback
 * while a deployed instance is protected. Swap `verify` for real JWT validation
 * (fetch the issuer's JWKS, check signature, exp, iss, and aud) before exposing
 * this to a network.
 */

import type { AuthOptions } from "./sdk"

const issuer = process.env.MCP_AUTH_ISSUER
const resource = process.env.MCP_RESOURCE ?? "http://127.0.0.1:3001/mcp"

export const auth: AuthOptions | undefined = issuer
  ? {
      resource,
      authorizationServers: [issuer],
      scopesSupported: ["dice:roll"],
      verify: async (token, audience) => {
        // Placeholder. A real verifier validates the signature against the
        // issuer's JWKS and rejects any token whose audience is not `audience`:
        // accepting one minted for another service is the confused-deputy bug
        // the spec forbids, and forwarding it onwards is worse.
        const claims = await introspect(token)
        if (!claims || claims.aud !== audience) return null

        return {
          subject: claims.sub,
          scopes: claims.scope?.split(" ") ?? [],
          claims,
        }
      },
    }
  : undefined

type Claims = { sub: string; aud?: string; scope?: string }

async function introspect(_token: string): Promise<Claims | null> {
  throw new Error(
    "Set up a real token verifier before enabling MCP_AUTH_ISSUER",
  )
}
