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
import { streamObject, streamText } from "ai";
import { z } from "zod";

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
  /**
   * Optional natural-language description of the editor's installed
   * extensions, composed by the frontend from each extension's
   * `schemaAwareness` blurb. Helps the model understand which custom
   * nodes/marks exist when generating structured output.
   */
  schemaAwareness?: string;
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

  const baseSystem = resolveSystemPrompt(body);
  const system = body.schemaAwareness
    ? `${baseSystem}\n\nThe editor exposes the following custom node types and marks. Where relevant, your output should respect these:\n\n${body.schemaAwareness}`
    : baseSystem;
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

// ─────────────────────────────────────────────────── /api/ai/edit

/**
 * Structured-edit endpoint. The model returns a list of operations
 * the editor applies as separate suggestions, each addressing a
 * specific block by its id. Useful for proofread-style multi-suggestion
 * passes where you want to show every change individually.
 *
 * Request body:
 *   {
 *     instruction: string,
 *     blocks: { id: string, text: string }[],   // block id → text content
 *     schemaAwareness?: string,
 *   }
 *
 * Response: streaming JSON of `{ operations: [{ type, target, content }] }`
 * via the AI SDK's streamObject protocol.
 */
const EditOperation = z.object({
  /**
   * - `replace`     — swap the target block's content with `content`.
   * - `insertBefore` — insert a new block before `target` with `content`.
   * - `insertAfter`  — insert a new block after `target` with `content`.
   */
  type: z.enum(["replace", "insertBefore", "insertAfter"]),
  /** Block id (from the editor's `id` global attribute) the op applies to. */
  target: z.string().describe("The id of the block this operation targets."),
  /** Plain-text content of the operation. v1: text only. */
  content: z.string(),
  /** Optional human-readable rationale shown in the review nav. */
  meta: z.string().optional(),
});

const EditOperations = z.object({
  operations: z.array(EditOperation),
});

interface EditRequestBody {
  instruction: string;
  blocks: Array<{ id: string; text: string }>;
  schemaAwareness?: string;
}

aiRoutes.post("/alt", async (c) => {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return c.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env or your shell env.",
      },
      500,
    );
  }
  const body = (await c.req.json().catch(() => null)) as {
    src?: string;
  } | null;
  const src = body?.src?.trim();
  if (!src) {
    return c.json({ error: "Body must include { src: string }" }, 400);
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(src);
  } catch {
    return c.json({ error: "src must be a valid URL" }, 400);
  }

  const result = streamText({
    model: anthropic("claude-haiku-4-5"),
    system:
      "You generate concise, accessible alt text for images. Return only the alt text — no preamble, no markdown, no quotes. Aim for under 140 characters. Describe the visible subject and notable context. Skip phrases like 'image of' or 'picture of'.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Generate accessible alt text for this image.",
          },
          { type: "image", image: imageUrl },
        ],
      },
    ],
    maxOutputTokens: 256,
  });

  return result.toTextStreamResponse();
});

aiRoutes.post("/edit", async (c) => {
  if (!process.env["ANTHROPIC_API_KEY"]) {
    return c.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it to .env or your shell env.",
      },
      500,
    );
  }

  const body = (await c.req.json().catch(() => null)) as EditRequestBody | null;
  if (!body || typeof body.instruction !== "string" || !Array.isArray(body.blocks)) {
    return c.json(
      {
        error:
          "Body must be { instruction: string, blocks: [{id, text}], schemaAwareness?: string }",
      },
      400,
    );
  }

  const baseSystem =
    "You are a structured-edit AI for a rich-text editor. The user gives you an instruction and a list of editable blocks (each with a stable id and current text). Return only operations needed to satisfy the instruction — do not rewrite blocks that don't need to change. Each operation's `target` MUST be the id of an existing block. Keep `content` as plain text.";
  const system = body.schemaAwareness
    ? `${baseSystem}\n\nThe editor exposes the following custom node types and marks:\n\n${body.schemaAwareness}`
    : baseSystem;

  const blockListing = body.blocks
    .map((b, i) => `[${i}] id=${b.id}\n${b.text}`)
    .join("\n\n");
  const message = `Instruction: ${body.instruction.trim()}\n\nBlocks:\n${blockListing}`;

  const result = streamObject({
    model: anthropic("claude-haiku-4-5"),
    schema: EditOperations,
    system,
    prompt: message,
    maxOutputTokens: 2048,
  });

  return result.toTextStreamResponse();
});
