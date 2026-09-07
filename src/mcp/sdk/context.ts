/**
 * Per-call state handed to every tool, resource and prompt handler.
 *
 * In a stateless protocol there is no session object, so this replaces it:
 * built fresh from one request, thrown away when it is answered. Everything it
 * knows arrived on that request.
 */

import { MISSING_REQUIRED_CLIENT_CAPABILITY, McpError } from "./protocol"
import type {
  CallToolParams,
  Elicitation,
  AuthInfo,
  Implementation,
  InputRequiredResult,
  ProtocolMeta,
} from "./types"

export class RequestContext {
  constructor(
    private readonly params: CallToolParams,
    private readonly meta: ProtocolMeta,
    /** The verified caller, when the endpoint requires authorization. */
    readonly authInfo?: AuthInfo,
  ) {}

  /** What this client declared it can do. Check before relying on a feature. */
  get clientCapabilities(): Record<string, unknown> {
    return this.meta.capabilities
  }

  /** Self-reported client name and version. For logs, never for decisions. */
  get clientInfo(): Implementation | undefined {
    return this.meta.clientInfo
  }

  /** The opaque blob this client echoed back on an MRTR retry. */
  get requestState(): string | undefined {
    return this.params.requestState
  }

  /** True when the caller's token carries this scope. */
  hasScope(scope: string): boolean {
    return this.authInfo?.scopes?.includes(scope) ?? false
  }

  /**
   * The user's answer to an earlier `elicit()`, or undefined on the first call.
   * Also undefined when they declined or cancelled — only an accepted answer
   * comes back.
   */
  answer<T = Record<string, unknown>>(key: string): T | undefined {
    const response = this.params.inputResponses?.[key]
    return response?.action === "accept" ? (response.content as T) : undefined
  }

  /**
   * Ask the user a question and end this request.
   *
   * The client prompts, then retries the whole call with the answer attached,
   * where `answer(key)` returns it. Two independent requests — possibly served
   * by different instances — written as one function.
   */
  elicit(key: string, ask: Elicitation): InputRequiredResult {
    // A server must never send an input request the client cannot service.
    if (!this.clientCapabilities.elicitation) {
      throw new McpError(
        MISSING_REQUIRED_CLIENT_CAPABILITY,
        "Client cannot prompt the user",
        {
          requiredCapabilities: ["elicitation"],
        },
      )
    }

    return {
      resultType: "input_required",
      inputRequests: {
        [key]: {
          method: "elicitation/create",
          params: {
            mode: "form",
            message: ask.message,
            requestedSchema: ask.schema,
          },
        },
      },
      // Toy default. A real one must be integrity-protected, bound to the
      // caller, and short-lived: it round-trips through the client.
      requestState: ask.state ?? key,
    }
  }
}
