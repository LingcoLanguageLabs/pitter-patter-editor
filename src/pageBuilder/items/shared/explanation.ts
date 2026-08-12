/**
 * The shared `item_explanation` node — the "here's why" rationale shown in a
 * gradable item's feedback block after it's graded. ONE node type, a required
 * trailing child of every gradable item (mc, categorization, estimate, …), so
 * "explain the answer" is one prompt-level capability, not a per-type thing.
 *
 * Rich inline content (so it can hold an italic phrase, a link, theme color),
 * edited inline in the builder; empty renders nothing on the site. Registered
 * once in `addItemNodes` and referenced by each item's content expression.
 */

import type { NodeSpec, Node as PmNode, Schema } from "prosemirror-model";

import type { JsonNode } from "../../runtime/shuffleLayout";

export const ITEM_EXPLANATION_NODE = "item_explanation";

export const itemExplanationSpec: NodeSpec = {
  content: "inline*",
  // No group — it's only ever an item's child, so the block pipeline (shuffle /
  // margin / …) skips it, like the other item child nodes.
  parseDOM: [{ tag: 'div[data-node-type="item-explanation"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "item-explanation", class: "pp-item-explanation" },
    0,
  ],
};

/** An empty explanation node — appended by every gradable item's `construct`. */
export function buildItemExplanation(schema: Schema): PmNode {
  const type = schema.nodes[ITEM_EXPLANATION_NODE];
  if (!type) throw new Error("item_explanation node not installed");
  return type.create();
}

/** The explanation's rich inline content, for `serialize()` — empty when the
 *  author left it blank (the completer then renders no explanation). */
export function serializeExplanation(node: JsonNode): JsonNode[] {
  return (
    (node.content ?? []).find((c) => c.type === ITEM_EXPLANATION_NODE)
      ?.content ?? []
  );
}
