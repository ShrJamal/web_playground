# Learning MCP by building one

Illustrated guides plus a dependency-free MCP server, both served from one Bun app.
Targets revision **2026-07-28** — the stateless one.

> `2026-07-28` removed the `initialize` handshake and protocol-level sessions. Every request
> carries its own protocol version and client capabilities in `_meta`, so any server instance
> can answer any request. Revisions up to `2025-11-25` are now called _legacy_.

## Run it

```sh
bun install
bun dev    # guides at http://127.0.0.1:3001/guides, MCP endpoint at /mcp
```

| Route                  | What's there                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `/guides`              | Overview — why MCP exists                                            |
| `/guides/architecture` | Host, client, server; who calls what                                 |
| `/guides/requests`     | Statelessness, per-request `_meta`, version negotiation, error codes |
| `/guides/primitives`   | Tools, resources, prompts, multi round-trip requests                 |
| `/guides/build`        | Build a server from scratch, then extract the SDK                    |
| `/guides/http`         | Streamable HTTP: mirrored headers, SSE, authorization                |
| `/guides/debug`        | Inspector, common bugs, security checklist                           |
| `/guides/faq`          | Who calls what, why there's no handshake, and other first questions  |

## The SDK

[`src/mcp/sdk/`](src/mcp/sdk/), no dependencies, one concern per file:

| File                                       | What's in it                                                  |
| ------------------------------------------ | ------------------------------------------------------------- |
| [`index.ts`](src/mcp/sdk/index.ts)         | Public surface                                                |
| [`server.ts`](src/mcp/sdk/server.ts)       | `McpServer`: registries, dispatch, `handle()`                 |
| [`context.ts`](src/mcp/sdk/context.ts)     | `RequestContext`: per-call state, `answer()` / `elicit()`     |
| [`protocol.ts`](src/mcp/sdk/protocol.ts)   | Version, `_meta` keys, error codes, `McpError`                |
| [`types.ts`](src/mcp/sdk/types.ts)         | Shared types                                                  |
| [`results.ts`](src/mcp/sdk/results.ts)     | `text()` / `toolError()`                                      |
| [`resources.ts`](src/mcp/sdk/resources.ts) | URI template matching, content builders                       |
| [`prompts.ts`](src/mcp/sdk/prompts.ts)     | Prompt message builders                                       |
| [`http.ts`](src/mcp/sdk/http.ts)           | Transport: Streamable HTTP                                    |
| [`handler.ts`](src/mcp/sdk/handler.ts)     | `createMcpHandler`: the serving entry, one server per request |
| [`client.ts`](src/mcp/sdk/client.ts)       | `McpClient`: the other half, including the MRTR retry         |
| [`headers.ts`](src/mcp/sdk/headers.ts)     | Header mirroring and validation (`-32020`)                    |
| [`auth.ts`](src/mcp/sdk/auth.ts)           | OAuth 2.1 resource server                                     |

Declare what you offer, then mount it:

```ts
export const mcpServer = new McpServer({ name: "dice-server", version: "1.0.0" })

mcpServer.registerTool(name, config, (args, context) => ...)               // model-controlled
mcpServer.registerResource(name, uriOrTemplate, config, ({ uri }) => ...)  // app-controlled
mcpServer.registerPrompt(name, config, (args) => ...)                      // user-controlled

// One fresh server per request, as the official SDK does it.
const mcp = createMcpHandler(() => mcpServer, { auth })

Bun.serve({ routes: { "/mcp": mcp.fetch, ...mcp.wellKnownRoutes() } })
```

The client half, used by the tests and worth reading for the MRTR retry:

```ts
const client = new McpClient("http://127.0.0.1:3001/mcp", {
  capabilities: { elicitation: {} },
  onElicit: async ({ message }) => ({
    action: "accept",
    content: { sides: 12 },
  }),
})

await client.discover()
await client.callTool("roll_for_me") // answers the server's question and retries
```

[`src/mcp/server.ts`](src/mcp/server.ts) is the dice server: three tools (one doing a multi
round-trip request, one reporting progress), two resources (one templated) and one prompt.

### See it work

```sh
bun mcp:walkthrough
```

[`src/mcp/walkthrough.ts`](src/mcp/walkthrough.ts) starts its own server and walks one
client through the whole protocol — no handshake, the `_meta` envelope, mirrored headers,
a tool call, a tool _failure_, the two-request MRTR round trip, resources, prompts, and a
version mismatch. Every request and response is printed as it goes on the wire, with a
note on what just happened and why.

Or drive it by hand — every request carries `_meta`, and the headers mirror the body:

```sh
curl -sS http://127.0.0.1:3001/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'mcp-protocol-version: 2026-07-28' \
  -H 'mcp-method: tools/list' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}'
```

No SSE: this SDK answers every request with a single JSON body. The spec permits
either, and `ttlMs`/`cacheScope` are what let clients re-fetch lists instead of
subscribing — so `subscriptions/listen` and progress notifications are out of scope.

**On clients:** this server is modern-only. Legacy clients open with `initialize` and get a
diagnostic naming the version we speak — that currently includes Claude Code 2.1.263. Dual-era
over HTTP would mean reimplementing `Mcp-Session-Id`, sticky routing and SSE resumability, so
this SDK deliberately does not.

## Authorization

Unauthenticated while bound to loopback. Set `MCP_AUTH_ISSUER` to enable the OAuth 2.1
resource-server path in [`src/mcp/auth-config.ts`](src/mcp/auth-config.ts), which then serves
RFC 9728 metadata, answers `401` with a `WWW-Authenticate` challenge, `403` with
`insufficient_scope`, and hands the caller to handlers as `context.identity`.

Your `verify` callback **must** check the signature, the expiry, and that the token's audience
is this exact server. Accepting one minted elsewhere is the confused-deputy bug the spec
forbids; forwarding it onwards is worse.

## Five rules that account for most bugs

1. **Headers mirror the body, and must agree.** A mismatch is `-32020`, never a reconciliation.
2. **Every request restates its version and capabilities** in `_meta`; reject an unknown
   version with `-32022` plus the list you do support.
3. **Every request re-authorizes.** There is no session to lean on — including for a handle you
   minted a call earlier.
4. **Every result needs `resultType`;** list results also need `ttlMs` and `cacheScope`.
5. **Tool failures are results with `isError: true`,** not JSON-RPC errors — the model reads
   them and self-corrects.

State spanning calls must be an explicit server-minted handle passed as a tool argument.

## Further reading

- [The 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28) — check the revision date on any MCP page you read
- [The changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog) — everything the stateless revision changed
