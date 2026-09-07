// The dice server: what this server offers, and nothing about how it is served.
// src/server.ts wraps it in a handler and mounts it on a route.

import {
  McpServer,
  ResourceTemplate,
  text,
  textResource,
  toolError,
  userMessage,
} from "./sdk"

export const mcpServer = new McpServer(
  { name: "dice-server", version: "1.0.0" },
  {
    instructions:
      "Rolls dice. Call roll_dice with a count and a number of sides.",
  },
)

mcpServer.registerTool(
  "roll_dice",
  {
    title: "Roll dice",
    description:
      "Roll N dice with S sides each and return the individual rolls and their total.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "integer", minimum: 1, maximum: 100, default: 1 },
        sides: { type: "integer", minimum: 2, maximum: 1000, default: 6 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  (args) => rollDice(Number(args.count ?? 1), Number(args.sides ?? 6)),
)

// A multi round-trip tool: the first call asks a question and ends, the client
// retries with the answer, and this runs again with context.answer() populated.
mcpServer.registerTool(
  "roll_for_me",
  {
    title: "Roll dice, asking the user how",
    description: "Roll one die, asking the user how many sides it should have.",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  (_args, context) => {
    const answer = context.answer<{ sides?: number }>("how_many_sides")
    if (answer) return rollDice(1, Number(answer.sides ?? 6))

    return context.elicit("how_many_sides", {
      message: "How many sides should the die have?",
      schema: {
        type: "object",
        properties: { sides: { type: "integer", minimum: 2, maximum: 1000 } },
        required: ["sides"],
      },
    })
  },
)

// A static resource: read-only reference data the host may attach to context.
// The model does not call this; the application decides to read it.
mcpServer.registerResource(
  "dice-notation",
  "dice://notation",
  {
    title: "Dice notation",
    description: "How NdS notation works.",
    mimeType: "text/markdown",
  },
  ({ uri }) => ({
    contents: [
      textResource(
        uri,
        "# Dice notation\n\n`NdS` means roll N dice of S sides each.\n`3d20` is three twenty-sided dice.",
        "text/markdown",
      ),
    ],
  }),
)

// A templated resource: the uri carries a variable, and the captured value
// reaches the reader. Templates never appear in resources/list.
mcpServer.registerResource(
  "dice-odds",
  new ResourceTemplate("dice://odds/{sides}"),
  {
    title: "Odds for one die",
    description: "The probability of each face on an S-sided die.",
    mimeType: "text/plain",
  },
  ({ uri, variables }) => {
    const sides = Number(variables.sides)
    if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
      return {
        contents: [
          textResource(uri, `Unsupported die: ${variables.sides} sides`),
        ],
      }
    }
    const chance = (100 / sides).toFixed(2)
    return {
      contents: [
        textResource(
          uri,
          `A d${sides} rolls each face ${chance}% of the time.`,
        ),
      ],
    }
  },
)

// A prompt: a template a person invokes deliberately, not something the model
// decides to call. What it returns is input to the model, not an answer.
mcpServer.registerPrompt(
  "explain-roll",
  {
    title: "Explain a roll",
    description: "Ask for a roll and an explanation of how likely it was.",
    argsSchema: [
      {
        name: "notation",
        description: "Dice notation, e.g. 3d20",
        required: true,
      },
      { name: "context", description: "What the roll is for" },
    ],
  },
  (args) => ({
    description: `Roll ${args.notation} and explain the odds`,
    messages: [
      userMessage(
        `Roll ${args.notation} using the roll_dice tool${args.context ? ` for ${args.context}` : ""}, ` +
          "then explain how likely that total was.",
      ),
    ],
  }),
)

// Argument validation failures come back as tool results, not protocol errors,
// so the model can read the message and retry.
function rollDice(count: number, sides: number) {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    return toolError("count must be an integer between 1 and 100")
  }
  if (!Number.isInteger(sides) || sides < 2 || sides > 1000) {
    return toolError("sides must be an integer between 2 and 1000")
  }

  const rolls = Array.from(
    { length: count },
    () => 1 + Math.floor(Math.random() * sides),
  )
  const total = rolls.reduce((sum, roll) => sum + roll, 0)
  return text(
    `Rolled ${count}d${sides}: ${rolls.join(", ")} (total ${total})`,
    { rolls, total },
  )
}
