/**
 * Builders for the messages a `prompts/get` result returns.
 *
 * These messages are input to the model, not an answer for the user.
 */

import type { PromptMessage } from "./types"

/** A message attributed to the user, as though they had typed it. */
export function userMessage(text: string): PromptMessage {
  return { role: "user", content: { type: "text", text } }
}

/** A message attributed to the assistant — use these to seed a few-shot exchange. */
export function assistantMessage(text: string): PromptMessage {
  return { role: "assistant", content: { type: "text", text } }
}
