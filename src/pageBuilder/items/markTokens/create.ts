/**
 * Mark the Words — node factories. `buildMarkTokens` makes a populated question
 * (used by demo docs); `constructMarkTokens` is the catalog default inserted from
 * the "+ Add block" picker. Both stamp a stable `itemId`.
 *
 * The markable sentence is built word-by-word: each word becomes a text node, and
 * the words named in `targets` get the `mttoken` mark (the answer key). PM merges
 * adjacent same-mark text, so the stored paragraph ends up as alternating
 * unmarked/marked runs — exactly what `serialize` tokenizes back out.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import {
  MTTOKEN_MARK,
  MT_NODE,
  MT_PROMPT_NODE,
  MT_TEXT_NODE,
} from "./schema";

/** Strip surrounding punctuation so `targets: ["runs"]` still matches "runs," */
const bareWord = (w: string) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** Inline content for one markable line: words split out so each can carry (or
 *  not) the `mttoken` mark. Whitespace is kept as its own text node. */
function buildLine(
  schema: Schema,
  sentence: string,
  targets: ReadonlySet<string>,
): PmNode[] {
  const tokenMark = schema.marks[MTTOKEN_MARK];
  const parts: PmNode[] = [];
  for (const piece of sentence.split(/(\s+)/)) {
    if (!piece) continue;
    if (/^\s+$/.test(piece)) {
      parts.push(schema.text(piece));
      continue;
    }
    const isTarget = targets.has(piece) || targets.has(bareWord(piece));
    parts.push(
      isTarget && tokenMark
        ? schema.text(piece, [tokenMark.create()])
        : schema.text(piece),
    );
  }
  return parts;
}

export function buildMarkTokens(
  schema: Schema,
  prompt: string,
  sentence: string,
  /** Words (bare, no punctuation needed) that are correct to click. */
  targets: ReadonlyArray<string>,
): PmNode {
  const mt = schema.nodes[MT_NODE];
  const promptType = schema.nodes[MT_PROMPT_NODE];
  const textType = schema.nodes[MT_TEXT_NODE];
  const paragraph = schema.nodes["paragraph"];
  if (!mt || !promptType || !textType || !paragraph) {
    throw new Error("Mark-the-words schema not installed. Is the item registered?");
  }
  const promptNode = promptType.create(
    null,
    paragraph.create(null, prompt ? schema.text(prompt) : undefined),
  );
  const textNode = textType.create(
    null,
    paragraph.create(null, buildLine(schema, sentence, new Set(targets))),
  );
  return mt.create({ itemId: newId("mt") }, [
    promptNode,
    textNode,
    buildItemExplanation(schema),
  ]);
}

export function constructMarkTokens(schema: Schema): PmNode {
  return buildMarkTokens(
    schema,
    "Click all the verbs.",
    "The clever fox jumps over the fence and runs into the woods.",
    ["jumps", "runs"],
  );
}
