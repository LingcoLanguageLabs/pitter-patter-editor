/**
 * Text Prompt — schema.
 *
 *   text_prompt        — outer block (group "block"): a free-response question.
 *                        Gets shuffle grid attrs / margin / section-containment
 *                        for free (inserted before those pipeline steps).
 *     text_prompt_stem — the question STEM (exactly one): a block container
 *                        (`block+`) holding any content blocks — a paragraph by
 *                        default, but images / audio / headings can be added.
 *                        The "put anything" stem, rendered via the shared block
 *                        walker, exactly like `mc_prompt`.
 *
 * The student's answer FIELD is not a doc node — there's no authored content for
 * it. The builder NodeView shows a preview of it and the completer renders the
 * real (interactive) one, both driven by the outer block's attrs:
 *   • `variant`     — "short" (single-line input) | "long" (resizable textarea).
 *   • `placeholder` — custom placeholder, editable under the Attributes section.
 *
 * `isolating` keeps the cursor/selection inside the block. The stem child has no
 * group, so the shuffle / margin / name / containment steps skip it.
 */

import type { NodeSpec } from "prosemirror-model";

export const TEXT_PROMPT_NODE = "text_prompt";
export const TEXT_PROMPT_STEM_NODE = "text_prompt_stem";

/** Answer-field variants — the segmented control in the settings panel. */
export const TEXT_PROMPT_VARIANTS = ["short", "long"] as const;
export type TextPromptVariant = (typeof TEXT_PROMPT_VARIANTS)[number];

/** Short-input width: "fill" stretches to the full column, "compact" is half
 *  width. Meaningless for the long textarea (always full width + drag-resizable). */
export const TEXT_PROMPT_WIDTHS = ["fill", "compact"] as const;
export type TextPromptWidth = (typeof TEXT_PROMPT_WIDTHS)[number];

/** Placeholder shown when the author hasn't set a custom one. */
export const TEXT_PROMPT_DEFAULT_PLACEHOLDER = "Type your answer…";

export const textPromptSpec: NodeSpec = {
  group: "block",
  content: TEXT_PROMPT_STEM_NODE,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** "short" = single-line input, "long" = multi-line resizable textarea. */
    variant: { default: "short" as TextPromptVariant },
    /** Short-input width: "fill" (full column) | "compact" (half width). Ignored
     *  by the long textarea. Named `fieldWidth` (not `width`) so it doesn't get
     *  swept into the generic `pp-width-*` attr-class mapping. */
    fieldWidth: { default: "fill" as TextPromptWidth },
    /** Custom answer-field placeholder ("" = the built-in default). Edited under
     *  the block's Attributes section, like `alt`/`lang`. */
    placeholder: { default: "" },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="text-prompt"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const variant = dom.getAttribute("data-variant");
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          variant: variant === "long" ? "long" : "short",
          fieldWidth:
            dom.getAttribute("data-field-width") === "compact"
              ? "compact"
              : "fill",
          placeholder: dom.getAttribute("data-placeholder") || "",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "text-prompt",
      class: "pp-text-prompt",
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["variant"] === "long") attrs["data-variant"] = "long";
    if (a["fieldWidth"] === "compact") attrs["data-field-width"] = "compact";
    if (a["placeholder"]) attrs["data-placeholder"] = a["placeholder"] as string;
    return ["div", attrs, 0];
  },
};

export const textPromptStemSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="text-prompt-stem"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "text-prompt-stem", class: "pp-text-prompt-stem" },
    0,
  ],
};
