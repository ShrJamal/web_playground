/**
 * Resource helpers: URI template matching and content builders.
 */

import type { ResourceContents } from "./types"

/**
 * A parameterised resource address, e.g. `dice://odds/{sides}`.
 *
 * Pass one to `registerResource()` in place of a plain uri. Templates are
 * returned by `resources/templates/list`, never by `resources/list` — there is
 * nothing finite to enumerate — so register concrete uris for anything a person
 * should be able to find in a picker.
 *
 * The pattern is compiled once here, at registration, rather than on every read.
 */
export class ResourceTemplate {
  private readonly pattern: RegExp
  private readonly names: string[]

  constructor(readonly uriTemplate: string) {
    const names: string[] = []

    // Escape everything, then turn the escaped `{var}` placeholders back into
    // capture groups. A variable never spans a path segment.
    const source = uriTemplate
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\{(\w+)\\\}/g, (_, name) => {
        names.push(name)
        return "([^/]+)"
      })

    this.pattern = new RegExp(`^${source}$`)
    this.names = names
  }

  /** Captured variables when `uri` matches this template, otherwise null. */
  match(uri: string): Record<string, string> | null {
    const match = this.pattern.exec(uri)
    if (!match) return null

    return Object.fromEntries(
      this.names.map((name, index) => [
        name,
        decodeURIComponent(match[index + 1]!),
      ]),
    )
  }
}

/** Text contents for a `resources/read` result. */
export function textResource(
  uri: string,
  text: string,
  mimeType = "text/plain",
): ResourceContents {
  return { uri, mimeType, text }
}
