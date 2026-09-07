/**
 * A narrated round trip: what a client sends, what the server does with it, and
 * what comes back — one step at a time.
 *
 *     bun src/mcp/walkthrough.ts
 *
 * It starts its own server on a spare port, so nothing else needs to be running.
 * Every request is printed as it goes on the wire; nothing is hidden behind the
 * SDK. Read it top to bottom once, then read src/mcp/sdk/ and it should all be
 * familiar.
 */

import { createMcpHandler, McpClient, PROTOCOL_VERSION_META_KEY } from "./sdk"
import { mcpServer } from "./server"

// JSON-RPC ids must be unique within a connection. They are the only thing that
// correlates a response to a request.
let nextId = 1

const PORT = 3099
const ENDPOINT = `http://127.0.0.1:${PORT}/mcp`

// The server half. One fresh McpServer per request — see sdk/handler.ts.
const handler = createMcpHandler(() => mcpServer)
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: PORT,
  routes: { "/mcp": handler.fetch },
})

// The client half. clientInfo and capabilities are *not* sent once at connect
// time — there is no connect. They ride along on every single request.
const client = new McpClient(ENDPOINT, {
  clientInfo: { name: "walkthrough", version: "1.0.0" },
  capabilities: { elicitation: {} },
  // Called when the server asks the user a question mid-call. Step 5 uses it.
  onElicit: ({ message }) => {
    console.log(`      the client asks its user: "${message}"`)
    console.log("      the user answers: 12")
    return { action: "accept", content: { sides: 12 } }
  },
})

// ---------------------------------------------------------------------------

step(1, "There is no handshake")
note(`Older MCP revisions opened with an 'initialize' exchange, and the server
remembered the result for the life of the connection. Since 2026-07-28 there is
no such thing. The first message a client sends is a real request — and so is
every message after it.

Watch what happens if we do open with 'initialize':`)

await raw("initialize", { protocolVersion: "2025-11-25" }, { skipMeta: true })

note(`404 with -32601. The server has no such method. The body names the version
it does speak, because a legacy client cannot discover that any other way.`)

// ---------------------------------------------------------------------------

step(2, "Every request carries its own envelope")
note(`Because nothing was negotiated up front, each request restates two things
in params._meta:

  io.modelcontextprotocol/protocolVersion    — which revision I am speaking
  io.modelcontextprotocol/clientCapabilities — what I can do, e.g. elicitation

Three of those fields are ALSO mirrored into HTTP headers, so a load balancer can
route on them without parsing the body:

  MCP-Protocol-Version   mirrors _meta protocolVersion
  Mcp-Method             mirrors  method
  Mcp-Name               mirrors  params.name (or params.uri)

If a header and the body disagree, the server rejects with -32020 rather than
picking a side — two components disagreeing about what a request *is* would be a
privilege-escalation shape. Here is that rejection:`)

await raw("tools/list", {}, { headerOverrides: { "mcp-method": "tools/call" } })

// ---------------------------------------------------------------------------

step(3, "Asking the server what it is")
note(`server/discover is the closest thing to a handshake left, and it is
OPTIONAL — a client may skip it and call a tool directly. It is worth one round
trip because it returns identity, supported versions, capabilities, and the
'instructions' string, which is returned nowhere else.

Note ttlMs and cacheScope on the way back: that is how a stateless server tells a
client how long it may cache, which is what replaced subscribing to changes.`)

const discovered = await raw("server/discover", {})

note(`The server only advertises capabilities it actually has something
registered for: ${Object.keys((discovered.result as Record<string, Record<string, unknown>>).capabilities).join(", ")}.
A client must never call into a capability that is not listed.`)

// ---------------------------------------------------------------------------

step(4, "Listing and calling a tool")
note(`Tools are the one primitive the MODEL decides to invoke. Everything else in
this script is decided by the client or a person.

The client lists tools; the definitions go into the model's prompt; the model
picks one and emits a tool-use block; the client turns that into tools/call.
The model never speaks JSON-RPC itself.`)

const listed = await client.listTools()
console.log(
  `   client.listTools() -> ${listed.tools.map((t) => t.name).join(", ")}`,
)
console.log(`   cache for ${listed.ttlMs} ms\n`)

await raw("tools/call", {
  name: "roll_dice",
  arguments: { count: 3, sides: 20 },
})

note(`Now the same call with a bad argument. Look at the status code: 200, not an
error. A tool failure is an ordinary RESULT with isError: true, because the model
can read that text and correct itself. JSON-RPC errors are reserved for things it
cannot fix — an unknown tool, a malformed request, a server fault.`)

await raw("tools/call", { name: "roll_dice", arguments: { count: 0 } })

// ---------------------------------------------------------------------------

step(5, "When the server needs to ask the user something")
note(`A stateless server cannot hold a request open while a human answers. So it
does not try. Multi Round-Trip Requests turn one logical call into two
independent HTTP requests:

  1. client calls the tool
  2. server answers resultType: "input_required", carrying the question and an
     opaque requestState — then FORGETS EVERYTHING
  3. client asks the user
  4. client retries the WHOLE call, with a NEW json-rpc id, echoing requestState
     back byte for byte and attaching the answer
  5. server has enough to finish

Request one — the server asks:`)

const asked = await raw("tools/call", { name: "roll_for_me", arguments: {} })
const inputRequests = (
  asked.result as { inputRequests: Record<string, unknown> }
).inputRequests
const requestState = (asked.result as { requestState: string }).requestState

note(`resultType is "input_required", not "complete". The elicitation request is
keyed ("${Object.keys(inputRequests)[0]}") so a server can ask several things at once, and
requestState ("${requestState}") is opaque — the client must not parse it.

A real requestState must be signed and bound to the caller: it travels through
the client, so it is attacker-controlled input on the way back.

Request two — the client answers. Note the new id:`)

await raw("tools/call", {
  name: "roll_for_me",
  arguments: {},
  inputResponses: {
    how_many_sides: { action: "accept", content: { sides: 12 } },
  },
  requestState,
})

note(`The SDK does all of that for you. client.callTool() loops until the server
stops asking:`)

const rolled = await client.callTool("roll_for_me")
console.log(`   client.callTool("roll_for_me") -> ${rolled.content[0]?.text}\n`)

// ---------------------------------------------------------------------------

step(6, "The other two primitives")
note(`Resources are read-only data the APPLICATION attaches — the model never
fetches one. Prompts are templates a PERSON invokes.

resources/list returns only exact uris. A templated resource lives in a separate
list, because there is nothing finite to enumerate: dice://odds/{sides} has no
end. That is why a client's attachment picker usually shows nothing templated.`)

const { resources } = await client.listResources()
const { resourceTemplates } = await client.listResourceTemplates()
console.log(`   exact uris : ${resources.map((r) => r.uri).join(", ")}`)
console.log(
  `   templates  : ${resourceTemplates.map((r) => r.uriTemplate).join(", ")}\n`,
)

note(
  "Reading a templated uri anyway — the server matches it and hands the reader the captured variable:",
)
await raw("resources/read", { uri: "dice://odds/20" })

note(`A prompt returns MESSAGES, not an answer. The client drops them into the
conversation as if the user had typed them, then runs a normal model turn. This
one instructs the model to call roll_dice — so one slash command triggers a
prompts/get and then a tools/call.`)

await raw("prompts/get", {
  name: "explain-roll",
  arguments: { notation: "3d20" },
})

// ---------------------------------------------------------------------------

step(7, "Speaking the wrong version")
note(`Nothing was negotiated, so a version mismatch cannot be caught at connect
time — it is caught per request. The server rejects with -32022 and lists what it
does support, which is how a client falls back instead of giving up.`)

await raw("tools/list", {}, { version: "2025-11-25" })

note(`That is the whole protocol surface this SDK implements. Every exchange
above was one POST and one JSON body: no session, no stream, no state on the
server between any two of them.`)

server.stop(true)

// ---------------------------------------------------------------------------
// Helpers. These build the request by hand so the wire stays visible.
// ---------------------------------------------------------------------------

/**
 * Send one request, printing exactly what goes out and what comes back.
 *
 * This is what McpClient.request() does internally; it is spelled out here so
 * the envelope and the mirrored headers are not hidden.
 */
async function raw(
  method: string,
  params: Record<string, unknown>,
  options: {
    version?: string
    skipMeta?: boolean
    headerOverrides?: Record<string, string>
  } = {},
): Promise<{ result?: unknown; error?: unknown }> {
  const version = options.version ?? "2026-07-28"

  // The envelope that replaced the handshake.
  const meta = options.skipMeta
    ? undefined
    : {
        [PROTOCOL_VERSION_META_KEY]: version,
        "io.modelcontextprotocol/clientCapabilities": { elicitation: {} },
        "io.modelcontextprotocol/clientInfo": {
          name: "walkthrough",
          version: "1.0.0",
        },
      }

  const body = {
    jsonrpc: "2.0" as const,
    id: nextId++,
    method,
    params: meta ? { ...params, _meta: meta } : params,
  }

  // The headers that mirror it.
  const name = (params.name ?? params.uri) as string | undefined
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": version,
    "mcp-method": method,
    ...(name ? { "mcp-name": name } : {}),
    ...options.headerOverrides,
  }

  console.log(`   --> POST ${ENDPOINT}`)
  for (const [key, value] of Object.entries(headers)) {
    if (key !== "content-type" && key !== "accept")
      console.log(`       ${key}: ${value}`)
  }
  console.log(indent(JSON.stringify(body, null, 2)))

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  const json = await response.json()

  console.log(`   <-- ${response.status}`)
  console.log(indent(JSON.stringify(json, null, 2)))
  console.log()

  return json
}

function step(number: number, title: string) {
  console.log(`\n${"═".repeat(78)}`)
  console.log(`STEP ${number}. ${title}`)
  console.log("═".repeat(78))
}

function note(text: string) {
  console.log(`\n${text.trim()}\n`)
}

/** Keep printed JSON inside the step's indentation. */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `       ${line}`)
    .join("\n")
}
