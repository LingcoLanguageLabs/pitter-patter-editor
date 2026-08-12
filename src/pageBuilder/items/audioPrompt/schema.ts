/**
 * Audio Prompt — schema.
 *
 *   audio_prompt        — outer block (group "block"): a record-your-answer
 *                         question. Gets shuffle grid attrs / margin /
 *                         section-containment for free (inserted before those
 *                         pipeline steps).
 *     audio_prompt_stem — the question STEM (exactly one): a block container
 *                         (`block+`) holding any content blocks — a paragraph by
 *                         default, but images / audio / headings can be added.
 *                         Rendered via the shared block walker, like `mc_prompt`.
 *
 * The recorder itself is not a doc node — the builder NodeView shows a preview
 * and the completer renders the real (MediaRecorder-backed) one. Its behaviour
 * is driven by the outer block's attrs (the "options"):
 *   • `attempts`      — how many times the student may record (≥ 1).
 *   • `allowPlayback` — whether the student can play their recording back.
 *   • `allowUpload`   — whether the student can upload an audio file instead.
 */

import type { NodeSpec } from "prosemirror-model";

export const AUDIO_PROMPT_NODE = "audio_prompt";
export const AUDIO_PROMPT_STEM_NODE = "audio_prompt_stem";

export const audioPromptSpec: NodeSpec = {
  group: "block",
  content: AUDIO_PROMPT_STEM_NODE,
  defining: true,
  isolating: true,
  attrs: {
    /** Stable id for response keying / persistence. Stamped on construct. */
    itemId: { default: "" },
    /** Allowed recording attempts (≥ 1). */
    attempts: { default: 1 },
    /** Whether the student can play their recording back. */
    allowPlayback: { default: true },
    /** Whether the student can upload an audio file instead of recording. */
    allowUpload: { default: false },
  },
  parseDOM: [
    {
      tag: 'div[data-node-type="audio-prompt"]',
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const attempts = dom.getAttribute("data-attempts");
        return {
          itemId: dom.getAttribute("data-item-id") || "",
          attempts: attempts == null ? 1 : Math.max(1, Number(attempts) || 1),
          allowPlayback: dom.getAttribute("data-allow-playback") !== "false",
          allowUpload: dom.getAttribute("data-allow-upload") === "true",
        };
      },
    },
  ],
  toDOM(node) {
    const a = node.attrs;
    const attrs: Record<string, string> = {
      "data-node-type": "audio-prompt",
      class: "pp-audio-prompt",
    };
    if (a["itemId"]) attrs["data-item-id"] = a["itemId"] as string;
    if (a["attempts"] !== 1) attrs["data-attempts"] = String(a["attempts"]);
    if (a["allowPlayback"] === false) attrs["data-allow-playback"] = "false";
    if (a["allowUpload"]) attrs["data-allow-upload"] = "true";
    return ["div", attrs, 0];
  },
};

export const audioPromptStemSpec: NodeSpec = {
  // Block container (the question stem) — holds any content blocks, defaults to
  // one paragraph. `block+` so it's never empty.
  content: "block+",
  defining: true,
  parseDOM: [{ tag: 'div[data-node-type="audio-prompt-stem"]' }],
  toDOM: () => [
    "div",
    { "data-node-type": "audio-prompt-stem", class: "pp-audio-prompt-stem" },
    0,
  ],
};
