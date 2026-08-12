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
  // Drop cap is a boolean paragraph effect, not a value→class mapping, so it's
  // handled directly: present ⇒ the `pp-dropcap` class (CSS styles ::first-letter).
  if (attrs["dropCap"]) out.push("pp-dropcap");
  return out;
}

/**
 * The block's opacity, when set to a value that actually fades it. Returns the
 * 0–1 number to surface as the `--pp-bg-opacity` custom property, or null when
 * unset (default, fully opaque) or 1 (a no-op). Shared by the editor decoration
 * pass and the runtime walker so both fade identically.
 *
 * It's a CSS *variable*, not the `opacity` property, on purpose: opacity must
 * fade only the block's BACKGROUND (fill / media), never its text — the CSS for
 * each visual block reads `--pp-bg-opacity` into a `color-mix` on its fill (card
 * / section / button) or onto its media layer (image / video / section media).
 * Element `opacity` would cascade to the content and make text unreadable.
 */
export function blockOpacity(attrs: Record<string, unknown>): number | null {
  const v = attrs["opacity"];
  return typeof v === "number" && v < 1 ? v : null;
}

/**
 * Optional px width clamps (`minW` / `maxW`, 0 = none) read off any block node.
 * Shared by the editor decoration pass and the runtime walker so a block's width
 * is bounded identically on canvas and site; a pinned image folds these into its
 * absolute style too.
 */
export function widthLimits(attrs: Record<string, unknown>): {
  minW: number;
  maxW: number;
} {
  return {
    minW: Number(attrs["minW"] ?? 0) || 0,
    maxW: Number(attrs["maxW"] ?? 0) || 0,
  };
}

/**
 * Container-only flex-stack modifiers — the `.container`'s layout classes,
 * shared (like `attrClasses`) by the editor decoration pass and the runtime
 * walker so both emit identical markup. Only NON-default values emit a class,
 * so a bare `.container` keeps the defaults (vertical, stretch, start, wrap);
 * inter-child spacing is the per-child `margin`, not here. Mirrors pagy's
 * Stack modifier vocabulary (`-row`, `-align-center`, `-justify-between`, …).
 */
export function stackClasses(attrs: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (attrs["axis"] === "horizontal") out.push("-horizontal");
  const align = attrs["stackAlign"];
  if (typeof align === "string" && align && align !== "stretch") {
    out.push(`-align-${align}`);
  }
  const justify = attrs["stackJustify"];
  if (typeof justify === "string" && justify && justify !== "start") {
    out.push(`-justify-${justify}`);
  }
  if (attrs["wrap"] === false) out.push("-nowrap");
  return out;
}

/** Table style modifiers — `pp-table--*` classes from the `table` node's style
 *  attrs (borders / stripes / density). Shared (like `stackClasses`) by the
 *  editor decoration pass and the runtime walker so the canvas matches the site;
 *  the default values ("all" borders, comfortable, unstriped) emit nothing. */
export function tableClasses(attrs: Record<string, unknown>): string[] {
  const out: string[] = [];
  const borders = attrs["borders"];
  if (borders === "rows") out.push("pp-table--rows");
  else if (borders === "none") out.push("pp-table--none");
  if (attrs["striped"]) out.push("pp-table--striped");
  if (attrs["density"] === "compact") out.push("pp-table--compact");
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
    // Container layout modifiers (axis/align/justify/wrap) ride along too.
    if (node.type.name === "container") classes.push(...stackClasses(node.attrs));
    // Table style modifiers (borders/stripes/density) — the decoration lands the
    // class on the table node DOM (the builder's columnResizing wrapper).
    if (node.type.name === "table") classes.push(...tableClasses(node.attrs));
    // Opacity rides as the `--pp-bg-opacity` custom property on the same
    // decoration (PM merges it onto the node's existing style). The block's CSS
    // reads it to fade only the background — never the content. Node views that
    // set their own style already merge the injected style (the same channel
    // shuffle's grid style uses), so the variable survives.
    const opacity = blockOpacity(node.attrs);
    // The block's language (text-bearing blocks only) rides as a real `lang`
    // attribute on the same node decoration — PM merges it onto the node's DOM,
    // so the editor canvas tags the block exactly as the site will, and the
    // in-editor `:lang()` styling / spellcheck switch with it.
    const lang = node.attrs["lang"];
    // Width clamps ride as inline min/max-width on the same decoration.
    const { minW, maxW } = widthLimits(node.attrs);
    const attrs: { class?: string; style?: string; lang?: string } = {};
    if (classes.length > 0) attrs.class = classes.join(" ");
    const styleParts: string[] = [];
    if (opacity != null) styleParts.push(`--pp-bg-opacity:${opacity}`);
    if (minW > 0) styleParts.push(`min-width:${minW}px`);
    if (maxW > 0) styleParts.push(`max-width:${maxW}px`);
    if (styleParts.length > 0) attrs.style = styleParts.join(";");
    if (typeof lang === "string" && lang) attrs.lang = lang;
    if (!attrs.class && !attrs.style && !attrs.lang) return true;
    decos.push(Decoration.node(pos, pos + node.nodeSize, attrs));
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
