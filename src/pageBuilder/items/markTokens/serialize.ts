/**
 * Mark the Words — serialize() boundary. Doc JSON → a typed, PM-free payload:
 *   • `prompt` — the question's content blocks (rendered by the shared walker;
 *                the static instruction + any media).
 *   • `lines`  — the markable text, tokenized into clickable words. One array per
 *                visual line (paragraph / hard-break run). A token is a `target`
 *                (correct to click) when its source text node carries the
 *                `mttoken` mark.
 *
 * Tokenization rides on ProseMirror's text-node splitting: PM stores a run of
 * identically-marked text as ONE text node, so a marked word is its own node and
 * "does this node carry the mark" is an exact, per-word answer — no fuzzy range
 * overlap. Within a node we split on whitespace into words; the completer rejoins
 * tokens with a single space, so punctuation stays attached to its word and the
 * original spacing is irrelevant.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import { serializeExplanation } from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import { MTTOKEN_MARK, MT_PROMPT_NODE, MT_TEXT_NODE } from "./schema";

export interface MtToken {
  /** Stable id (document-order index) — what the response set keys off. */
  id: string;
  text: string;
  /** Is clicking this word correct? (the answer key) */
  target: boolean;
}

export type MtLine = MtToken[];

export interface MarkTokensDef {
  itemId: string;
  points: number;
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  /** The question stem's content BLOCKS, rendered by the shared block walker. */
  prompt: JsonNode[];
  /** The markable text as lines of clickable tokens. */
  lines: MtLine[];
}

function hasTokenMark(textNode: JsonNode): boolean {
  return (textNode.marks ?? []).some((m) => m.type === MTTOKEN_MARK);
}

/** Tokenize one paragraph's inline content into lines (split on hard breaks),
 *  threading a running counter so token ids are unique + document-order stable
 *  across the whole item. */
function tokenizeParagraph(
  para: JsonNode,
  next: () => string,
): MtLine[] {
  const lines: MtLine[] = [];
  let current: MtLine = [];
  for (const inline of para.content ?? []) {
    if (inline.type === "hard_break") {
      lines.push(current);
      current = [];
      continue;
    }
    if (inline.type !== "text" || !inline.text) continue;
    const target = hasTokenMark(inline);
    for (const word of inline.text.split(/\s+/)) {
      if (!word) continue;
      current.push({ id: next(), text: word, target });
    }
  }
  lines.push(current);
  // Drop fully-empty lines (e.g. a blank paragraph) — they carry no tokens.
  return lines.filter((l) => l.length > 0);
}

export function serializeMarkTokens(node: JsonNode): MarkTokensDef {
  const a = node.attrs ?? {};
  const children = node.content ?? [];
  const prompt = children.find((c) => c.type === MT_PROMPT_NODE)?.content ?? [];
  const textNode = children.find((c) => c.type === MT_TEXT_NODE);

  let counter = 0;
  const next = () => String(counter++);
  const lines: MtLine[] = (textNode?.content ?? []).flatMap((para) =>
    para.type === "paragraph" ? tokenizeParagraph(para, next) : [],
  );

  return {
    itemId: (a["itemId"] as string) || "",
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    prompt,
    lines,
  };
}

/** Ids of the correct (target) tokens — the answer key, used by grading. */
export function targetIds(def: MarkTokensDef): Set<string> {
  const ids = new Set<string>();
  for (const line of def.lines)
    for (const t of line) if (t.target) ids.add(t.id);
  return ids;
}
