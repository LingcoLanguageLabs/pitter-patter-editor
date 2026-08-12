/**
 * Fill Blanks — serialize() boundary. Doc JSON → a typed, PM-free payload:
 *   • `stem`   — the question's content blocks (rendered by the shared walker;
 *                blanks within are delegated to the completer's inline renderer).
 *   • `blanks` — a flat, document-order list of blank defs, for the word bank
 *                and grading.
 */

import type { JsonNode } from "../../runtime/shuffleLayout";
import {
  ITEM_EXPLANATION_NODE,
  serializeExplanation,
} from "../shared/explanation";
import { serializeFeedback, type FeedbackMessages } from "../shared/scoring";
import {
  BLANK_NODE,
  type BankPosition,
  type BlankMode,
  type BlankOption,
} from "./schema";

export interface FbBlankDef {
  blankId: string;
  mode: BlankMode;
  options: BlankOption[];
  answerId: string;
  /** Convenience: text of the correct option. */
  answer: string;
  /** Additional accepted answers (text mode), beyond `answer`. */
  alternates: string[];
}

export interface FillBlanksDef {
  itemId: string;
  points: number;
  feedback: FeedbackMessages;
  /** The "here's why" rationale (rich inline), shown in the feedback block. */
  explanation: JsonNode[];
  wordBank: boolean;
  /** Word-bank only: extra bank words that fit no blank. */
  bankDistractors: string[];
  /** Word-bank only: bank above ("top") or below ("bottom") the question. */
  bankPosition: BankPosition;
  /** Content blocks of the question (paragraphs with inline blanks, media, …). */
  stem: JsonNode[];
  /** Blanks in document order. */
  blanks: FbBlankDef[];
}

export function blankDefFromNode(node: JsonNode): FbBlankDef {
  const a = node.attrs ?? {};
  const options = (a["options"] as BlankOption[]) ?? [];
  const answerId = (a["answerId"] as string) ?? "";
  return {
    blankId: (a["blankId"] as string) ?? "",
    mode: (a["mode"] as BlankMode) ?? "text",
    options,
    answerId,
    answer: options.find((o) => o.id === answerId)?.text ?? "",
    alternates: (a["alternates"] as string[]) ?? [],
  };
}

function collectBlanks(blocks: readonly JsonNode[]): FbBlankDef[] {
  const out: FbBlankDef[] = [];
  const walk = (n: JsonNode) => {
    if (n.type === BLANK_NODE) out.push(blankDefFromNode(n));
    (n.content ?? []).forEach(walk);
  };
  blocks.forEach(walk);
  return out;
}

export function serializeFillBlanks(node: JsonNode): FillBlanksDef {
  const a = node.attrs ?? {};
  // The stem is the block content MINUS the trailing explanation node (which is
  // rendered in the feedback block, not the question body).
  const stem = (node.content ?? []).filter(
    (c) => c.type !== ITEM_EXPLANATION_NODE,
  );
  return {
    itemId: (a["itemId"] as string) || "",
    points: typeof a["points"] === "number" ? (a["points"] as number) : 1,
    feedback: serializeFeedback(a),
    explanation: serializeExplanation(node),
    wordBank: !!a["wordBank"],
    bankDistractors: (a["bankDistractors"] as string[]) ?? [],
    bankPosition: a["bankPosition"] === "bottom" ? "bottom" : "top",
    stem,
    blanks: collectBlanks(stem),
  };
}
