/**
 * AI routes — POST /api/ai
 *
 * Streams Claude completions over the Vercel AI SDK text stream
 * protocol. The frontend Ai extension consumes that stream and inserts
 * chunks into the doc as they arrive.
 *
 * Protocol:
 *
 *   POST /api/ai
 *   { prompt: string, instruction?: string, mode?: PresetMode, system?: string }
 *   →  text/plain streaming response (UTF-8 chunks)
 *
 * The editor sends `instruction` (the high-level intent — "rephrase",
 * "shorten", a freeform prompt) and `prompt` (the user's selected text
 * or surrounding context). The server composes the full system + user
 * messages and delegates to Anthropic via the AI SDK.
 */

import { anthropic } from "@ai-sdk/anthropic";
import { Hono } from "hono";
import { streamText } from "ai";

interface AiRequestBody {
  prompt: string;
  instruction?: string;
  mode?:
    | "rephrase"
    | "shorten"
    | "extend"
    | "fix-grammar"
    | "summarize"
    | "tldr"
    | "tone-formal"
    | "tone-casual"
    | "translate";
  language?: string;
  system?: string;
}

const PRESETS: Record<NonNullable<AiRequestBody["mode"]>, string> = {
  rephrase:
    "Rephrase the user's text. Keep the same meaning, register, and length. Return only the rephrased text — no preamble, no quotes, no explanation.",
  shorten:
    "Shorten the user's text by 30–50% while preserving the core meaning. Return only the shortened text.",
  extend:
    "Extend the user's text with one or two more sentences in the same voice. Return only the extended text (the original + the addition), no preamble.",
  "fix-grammar":
    "Fix any spelling, grammar, and punctuation errors in the user's text. Do not change the meaning, voice, or structure. Return only the corrected text.",
  summarize:
    "Summarize the user's text in one short paragraph. Return only the summary.",
  tldr:
    "Write a TL;DR of the user's text in one sentence. Return only the sentence.",
  "tone-formal":
    "Rewrite the user's text in a formal tone suitable for professional correspondence. Return only the rewritten text.",
  "tone-casual":
    "Rewrite the user's text in a casual, conversational tone. Return only the rewritten text.",
  translate:
    "Translate the user's text into the requested target language. Return only the translation.",
};

const FREEFORM_SYSTEM =
  "You are an inline writing assistant embedded in a rich-text editor. Apply the user's instruction to the supplied text. Return only the resulting text — no preamble, no markdown fences, no commentary. Preserve the original paragraph structure unless the instruction implies otherwise.";

function resolveSystemPrompt(body: AiRequestBody): string {
  if (body.system) return body.system;
  if (body.mode === "translate" && body.language) {
    return `${PRESETS.translate} The target language is ${body.language}.`;
  }
  if (body.mode && PRESETS[body.mode]) return PRESETS[body.mode];
  return FREEFORM_SYSTEM;
}

function resolveUserMessage(body: AiRequestBody): string {
  const instruction = body.mode ? "" : (body.instruction ?? "").trim();
  const prompt = (body.prompt ?? "").trim();
  if (instruction && prompt) {
    return `Instruction: ${instruction}\n\nText:\n${prompt}`;
  }
  if (instruction) return instruction;
  return prompt;
}

export const aiRoutes = new Hono();

aiRoutes.post("/", async (c) => {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return c.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env or your shell env.",
      },
      500,
    );
  }

  const body = (await c.req.json().catch(() => null)) as AiRequestBody | null;
  if (!body || typeof body.prompt !== "string") {
    return c.json({ error: "Body must be { prompt: string, ... }" }, 400);
  }

  const system = resolveSystemPrompt(body);
  const message = resolveUserMessage(body);

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system,
    prompt: message,
    maxOutputTokens: 1024,
  });

  // Plain text streaming — each network chunk is a UTF-8 fragment of
  // the model's output. The editor reads it via a fetch + ReadableStream.
  return result.toTextStreamResponse();
});
