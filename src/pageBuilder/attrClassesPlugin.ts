/**
 * Decorates every doc node with utility class names derived from
 * its attrs (align / size / width / color / alignContent), so the
 * CSS for those attrs can target `.pp-align-center`, `.pp-size-m`,
 * `.pp-width-fill`, etc. instead of `[data-align="center"]` selector
 * chains.
 *
 * Each visited node yields one PM `Decoration.node` whose `class`
 * spread is appended (by PM's view layer) onto whatever the node's
 * own `toDOM` returned. That means new attrs can be added without
 * touching every `toDOM` — declare the attr in the schema, register
 * its prefix here, done.
 *
 * Attr → class prefix mapping lives in `ATTR_TO_CLASS_PREFIX` so
 * the BlockSettings forms, this plugin, and the CSS file all use
 * the same vocabulary.
 */

import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { EditorState } from "prosemirror-state";
import type { Node as PmNode } from "prosemirror-model";

import { blockMarginClass, blockMarginValue } from "./spacing";

/** Schema attr name → utility-class prefix. The class becomes
 *  `${prefix}-${attrValue}`, e.g. attrs.align="center" → "pp-align-center". */
const ATTR_TO_CLASS_PREFIX: Record<string, string> = {
  align: "pp-align",
  size: "pp-size",
  width: "pp-width",
  color: "pp-color",
  // Image presentation (mirrors pagy's `.media` modifiers).
  shape: "pp-shape",
  radius: "pp-radius",
  frame: "pp-frame",
  // Card presentation (pagy's `.card` modifiers).
  padding: "pp-padding",
  overlay: "pp-overlay",
};

/**
 * Pure attr → utility-class list. Shared by this plugin (editor render)
 * and the runtime walker (`runtime/renderNode`, the published-site render)
 * so both emit the identical `pp-*` classes from the same attrs — no drift.
 */
export function attrClasses(attrs: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const attr of Object.keys(ATTR_TO_CLASS_PREFIX)) {
    const value = attrs[attr];
    if (value == null || value === "") continue;
    // Numeric spacing (the section's px `padding`) serializes as its own
    // Tailwind-style class (`py-{unit}`), not `pp-padding-{px}` — skip it
    // here so a number never leaks into the token-based pp-* vocabulary.
    if (typeof value === "number") continue;
    out.push(`${ATTR_TO_CLASS_PREFIX[attr]}-${value}`);
  }
  return out;
}

function buildDecorations(state: EditorState) {
  const decos: Decoration[] = [];
  state.doc.descendants((node, pos) => {
    const classes = attrClasses(node.attrs);
    // Top-margin rides along as a Tailwind-style `mt-{unit}` class (PM merges a
    // node decoration's `class` with the node's own toDOM class list). Only an
    // EXPLICIT value (incl 0) emits a class; Auto (null) emits none, so it falls
    // back to the per-context default — that's how Auto stays distinct from 0.
    const margin = blockMarginValue(node.attrs);
    if (margin != null) classes.push(blockMarginClass(margin));
    if (classes.length === 0) return true;
    decos.push(
      Decoration.node(pos, pos + node.nodeSize, { class: classes.join(" ") }),
    );
    return true;
  });
  return DecorationSet.create(state.doc, decos);
}

export function attrClassesPlugin() {
  return new Plugin({
    state: {
      init(_, state) {
        return buildDecorations(state);
      },
      apply(tr, old, _oldState, newState) {
        return tr.docChanged ? buildDecorations(newState) : old;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}
