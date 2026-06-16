/**
 * Block type conversion — one source of truth shared by the settings
 * popover's header switcher (`BlockSettings`) and the context menu's
 * "Turn into" submenu (`BlockContextMenu`), so the option lists and
 * the attr-carrying convert logic can't drift between the two UIs.
 */

import type { Node as PmNode } from "prosemirror-model";
import type { EditorView } from "prosemirror-view";

import { setSelectedBlocks } from "../blockHighlightPlugin";
import {
  PARAGRAPH_DEFAULT_SIZE,
  defaultHeadingSize,
  type Align,
  type Size,
} from "../schema";

/** Human labels for the align/size attr values — shared by the context
 *  menu and the selection toolbar so wording can't drift. */
export const ALIGN_LABELS: Record<Align, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
};

export const SIZE_LABELS: Record<Size, string> = {
  xs: "Extra small",
  s: "Small",
  m: "Medium",
  l: "Large",
  xl: "Extra large",
};

/** Block types you can convert between, grouped by compatible content.
 *  Mirrors pagy's panel-header type picker (paragraph ↔ heading-N,
 *  container ↔ card). */
export interface TypeOption {
  label: string;
  typeName: string;
  attrs?: Record<string, unknown>;
  /** Attrs stamped on convert but NOT part of the option's identity —
   *  a Heading 1 the user resized to "m" is still "Heading 1". Pagy
   *  does the same: switching text type also sets
   *  `size: defaultSizeForBlockType(type)`. */
  defaults?: Record<string, unknown>;
}

export const TEXT_TYPE_OPTIONS: readonly TypeOption[] = [
  {
    label: "Paragraph",
    typeName: "paragraph",
    defaults: { size: PARAGRAPH_DEFAULT_SIZE },
  },
  ...([1, 2, 3, 4] as const).map((level) => ({
    label: `Heading ${level}`,
    typeName: "heading",
    attrs: { level },
    defaults: { size: defaultHeadingSize(level) },
  })),
];

export const LAYOUT_TYPE_OPTIONS: readonly TypeOption[] = [
  { label: "Container", typeName: "container" },
  { label: "Card", typeName: "card" },
  { label: "Row", typeName: "row" },
];

/** The Paragraph target (reused for the button → text path). */
const PARAGRAPH_TYPE_OPTION = TEXT_TYPE_OPTIONS[0]!;

/** The Button target. Placement attrs (align / columns / margin) carry over in
 *  `convertBlockTypes`; everything else takes the button defaults (primary),
 *  with size reset to the button scale's small — pagy likewise resets size on a
 *  type switch. */
const BUTTON_TYPE_OPTION: TypeOption = {
  label: "Button",
  typeName: "button",
  defaults: { size: "s" },
};

/** Word count of a text block — gates paragraph → button. */
function wordCount(node: PmNode): number {
  return node.textContent.trim().split(/\s+/).filter(Boolean).length;
}

/** Options available for a given block, or null if it can't convert.
 *  Container / Card / Row all hold `block+`, so they interconvert
 *  (setNodeMarkup keeps the children; non-shared attrs like the row's
 *  lack of columns just fall back to the target's defaults). */
export function typeOptionsFor(node: PmNode): readonly TypeOption[] | null {
  const name = node.type.name;
  // Paragraph ↔ Button, but ONLY offer Button for a short label (≤3 words) so a
  // real paragraph of prose is never turned into a button by accident.
  if (name === "paragraph") {
    return wordCount(node) <= 3 ? [...TEXT_TYPE_OPTIONS, BUTTON_TYPE_OPTION] : TEXT_TYPE_OPTIONS;
  }
  if (name === "heading") return TEXT_TYPE_OPTIONS;
  // A button's label is inherently short, so it can always turn back into text.
  if (name === "button") return [BUTTON_TYPE_OPTION, PARAGRAPH_TYPE_OPTION];
  if (name === "container" || name === "card" || name === "row")
    return LAYOUT_TYPE_OPTIONS;
  return null;
}

export function isCurrentType(node: PmNode, opt: TypeOption): boolean {
  if (node.type.name !== opt.typeName) return false;
  if (!opt.attrs) return true;
  return Object.entries(opt.attrs).every(([k, v]) => node.attrs[k] === v);
}

/**
 * Convert the block at `pos` to another type (e.g. Paragraph →
 * Heading 2). Carries over whatever attrs the target type also
 * declares (align, shuffle columns) so layout/placement survive the
 * swap, then applies the option's defaults (e.g. the heading level's
 * default size) and identity attrs (e.g. level).
 *
 * Re-asserts the block selection on the same transaction —
 * setNodeMarkup's ReplaceAroundStep would otherwise map the position
 * as deleted and clear it. `quiet` keeps the settings popover closed
 * (context-menu flows); the popover's own switcher converts loudly.
 */
export function convertBlockType(
  view: EditorView,
  pos: number,
  opt: TypeOption,
  { quiet = false }: { quiet?: boolean } = {},
): void {
  convertBlockTypes(view, [pos], opt, { quiet });
}

/**
 * Multi-block variant — one transaction converting every position
 * (the selection toolbar's type picker can span several text blocks).
 * setNodeMarkup replaces a node in place without changing sizes, so
 * the positions stay valid throughout the loop.
 */
export function convertBlockTypes(
  view: EditorView,
  positions: number[],
  opt: TypeOption,
  { quiet = false }: { quiet?: boolean } = {},
): void {
  const { schema } = view.state;
  const type = schema.nodes[opt.typeName];
  if (!type) return;
  const allowed = type.spec.attrs ?? {};
  const tr = view.state.tr;
  // Positions are mapped through the running transaction: a text ↔ button swap
  // (below) is a full replace that changes node size, so later positions shift.
  const origins: number[] = [];
  for (const pos of positions) {
    const at = tr.mapping.map(pos);
    const node = tr.doc.nodeAt(at);
    if (!node) continue;
    const merged: Record<string, unknown> = {
      ...node.attrs,
      ...opt.defaults,
      ...opt.attrs,
    };
    const attrs = Object.fromEntries(
      Object.entries(merged).filter(([k]) => k in allowed),
    );
    if (node.isTextblock && type.isAtom) {
      // Text → atom (paragraph/heading → button): a button has no content, so
      // its text lives in the `label` attr. Carry the block's text across and
      // replace the node wholesale (setNodeMarkup would keep now-invalid inline
      // content). Marks are dropped — a button label is plain text.
      if ("label" in allowed) {
        attrs["label"] = node.textContent || String(attrs["label"] ?? "Button");
      }
      tr.replaceWith(at, at + node.nodeSize, type.create(attrs));
    } else if (node.type.isAtom && type.isTextblock) {
      // Atom → text (button → paragraph): the `label` attr becomes the text.
      const label = String(node.attrs["label"] ?? "");
      tr.replaceWith(at, at + node.nodeSize, type.create(attrs, label ? schema.text(label) : null));
    } else {
      // Same content model (text ↔ text, layout ↔ layout): in-place markup swap
      // keeps the children and the node size.
      tr.setNodeMarkup(at, type, attrs);
    }
    origins.push(pos);
  }
  if (!origins.length) return;
  // Map each source position to where its (possibly resized) block now starts.
  const converted = origins.map((p) => tr.mapping.map(p));
  view.dispatch(setSelectedBlocks(tr, converted, quiet));
}
