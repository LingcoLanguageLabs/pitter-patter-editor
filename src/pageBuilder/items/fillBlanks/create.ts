/**
 * Fill Blanks — node factories. `makeBlank` builds a blank inline node (used by
 * the mark-as-blank command and demo); `buildFillBlanks` builds a populated
 * question; `constructFillBlanks` is the catalog default.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import { buildItemExplanation } from "../shared/explanation";
import { newId } from "../shared/ids";
import {
  BLANK_NODE,
  FB_NODE,
  type BankPosition,
  type BlankMode,
  type BlankOption,
} from "./schema";

/** A blank whose single option (the answer) is the given text — a typed blank.
 *  `alternates` are extra accepted answers (text mode). Dropdown options are
 *  added later via the blank settings popover. */
export function makeBlank(
  schema: Schema,
  answerText: string,
  opts?: {
    mode?: BlankMode;
    options?: BlankOption[];
    answerId?: string;
    alternates?: string[];
  },
): PmNode {
  const blankType = schema.nodes[BLANK_NODE];
  if (!blankType) throw new Error("Fill-blanks schema not installed.");
  const answerId = newId("opt");
  const options: BlankOption[] = opts?.options ?? [
    { id: answerId, text: answerText },
  ];
  return blankType.create({
    blankId: newId("blank"),
    mode: opts?.mode ?? "text",
    options,
    answerId: opts?.answerId ?? options[0]?.id ?? answerId,
    alternates: opts?.alternates ?? [],
  });
}

/** A segment is plain text, or a blank marker. The marker can be a bare string
 *  answer or `{ blank, alternates }` to also accept synonyms / spellings. */
type FbSegment = string | { blank: string; alternates?: string[] };

export function buildFillBlanks(
  schema: Schema,
  segments: ReadonlyArray<FbSegment>,
  attrs?: { wordBank?: boolean; distractors?: string[]; position?: BankPosition },
): PmNode {
  const fb = schema.nodes[FB_NODE];
  const paragraph = schema.nodes["paragraph"];
  if (!fb || !paragraph) {
    throw new Error("Fill-blanks schema not installed. Is the item registered?");
  }
  const inline = segments
    .filter((s) => (typeof s === "string" ? s.length > 0 : !!s.blank))
    .map((s) =>
      typeof s === "string"
        ? schema.text(s)
        : makeBlank(schema, s.blank, { alternates: s.alternates }),
    );
  return fb.create(
    {
      itemId: newId("fb"),
      wordBank: !!attrs?.wordBank,
      bankDistractors: attrs?.distractors ?? [],
      bankPosition: attrs?.position ?? "top",
    },
    [paragraph.create(null, inline), buildItemExplanation(schema)],
  );
}

export function constructFillBlanks(schema: Schema): PmNode {
  return buildFillBlanks(schema, [
    "The capital of France is ",
    { blank: "Paris" },
    ".",
  ]);
}
