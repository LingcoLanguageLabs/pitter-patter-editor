/**
 * Builders for the "Add a section" template library.
 *
 * pagy.co authors its section presets as raw Slate JSON (see
 * `pagy.co/src/editor/templates/*`). We author ours as the equivalent
 * ProseMirror document JSON (`JsonNode` — the shape `RenderNode` and
 * `schema.nodeFromJSON` both consume), but through small typed builders
 * so every block carries the attrs its schema needs (notably the
 * `shuffleStart` / `shuffleEnd` grid columns) and the templates stay
 * readable.
 *
 * Grid model (mirrors pagy 1:1 — see `shuffle.css`): a 12-column content
 * band sits between two flexible rails. `start`/`end` are content columns
 * 1–12 (a block at start 1 / end 12 fills the band); 0 = left rail, 13 =
 * right rail for full-bleed. `start`/`end` here map straight onto pagy's
 * `start`/`end`, so ports are near-mechanical.
 */

import type { JsonNode } from "../runtime/shuffleLayout";

/** A section template — always a single `section` node. */
export type SectionTemplate = JsonNode;

type Leaf = JsonNode;

// ── Inline text + marks ──────────────────────────────────────────────
export function txt(text: string, marks?: JsonNode["marks"]): Leaf {
  return marks && marks.length ? { type: "text", text, marks } : { type: "text", text };
}

/** Minimal (un-underlined) link, the variant pagy uses for nav / footer links. */
export function link(text: string, href = "#"): Leaf {
  return {
    type: "text",
    text,
    marks: [{ type: "link", attrs: { href, newTab: false, variant: "minimal" } }],
  };
}

export function bold(text: string): Leaf {
  return { type: "text", text, marks: [{ type: "strong" }] };
}

/** Muted text (pagy's `color: "light"` leaf) — the theme's soft text slot. */
export function muted(text: string): Leaf {
  return {
    type: "text",
    text,
    marks: [{ type: "textColor", attrs: { color: "muted" } }],
  };
}

// ── Block options ────────────────────────────────────────────────────
interface Cols {
  /** Content column 1–12 (0 = left rail). Defaults to the full band. */
  start?: number;
  /** Content column 1–12 (13 = right rail). */
  end?: number;
}

type TextOpts = Cols & { align?: "left" | "center" | "right"; size?: Size };
type Size = "xs" | "s" | "m" | "l" | "xl";

function shuffleAttrs(o: Cols, extra?: Record<string, unknown>) {
  return { shuffleStart: o.start ?? 1, shuffleEnd: o.end ?? 12, ...(extra ?? {}) };
}

// ── Section ──────────────────────────────────────────────────────────
export function section(
  attrs: {
    padding?: "small" | "medium" | "large";
    minHeight?: "none" | "medium" | "large";
    contentAlign?: "top" | "center" | "bottom";
    theme?: string;
  },
  children: JsonNode[],
): SectionTemplate {
  return {
    type: "section",
    attrs: {
      padding: attrs.padding ?? "large",
      minHeight: attrs.minHeight ?? "none",
      contentAlign: attrs.contentAlign ?? "top",
      background: "solid",
      ...(attrs.theme ? { theme: attrs.theme } : {}),
    },
    content: children,
  };
}

// ── Text blocks ──────────────────────────────────────────────────────
export function heading(level: 1 | 2 | 3 | 4, content: string | Leaf[], o: TextOpts = {}): JsonNode {
  return {
    type: "heading",
    attrs: { level, align: o.align ?? "left", ...(o.size ? { size: o.size } : {}), ...shuffleAttrs(o) },
    content: typeof content === "string" ? [txt(content)] : content,
  };
}

export function paragraph(content: string | Leaf[], o: TextOpts = {}): JsonNode {
  return {
    type: "paragraph",
    attrs: { align: o.align ?? "left", size: o.size ?? "m", ...shuffleAttrs(o) },
    content: typeof content === "string" ? [txt(content)] : content,
  };
}

// ── Button (atom) ────────────────────────────────────────────────────
export function button(
  label: string,
  o: Cols & {
    variant?: "primary" | "secondary" | "ghost";
    color?: "neutral" | "primary" | "secondary" | "tertiary";
    size?: Size;
    width?: "fit" | "fill";
    align?: "left" | "center" | "right";
    href?: string;
  } = {},
): JsonNode {
  return {
    type: "button",
    attrs: {
      label,
      variant: o.variant ?? "primary",
      color: o.color ?? "primary",
      size: o.size ?? "m",
      width: o.width ?? "fit",
      align: o.align ?? "left",
      linkType: "url",
      pageId: "",
      href: o.href ?? "#",
      openInNewTab: false,
      ...shuffleAttrs(o),
    },
  };
}

// ── Image (atom) — empty src renders the grey placeholder ────────────
export function image(
  o: Cols & {
    aspect?: "original" | "16/9" | "3/2" | "4/3";
    shape?: "" | "square" | "circle";
    radius?: "none" | "medium" | "large";
    frame?: "" | "inset" | "shadow";
  } = {},
): JsonNode {
  return {
    type: "image",
    attrs: {
      src: "",
      alt: "",
      aspect: o.aspect ?? "16/9",
      shape: o.shape ?? "",
      radius: o.radius ?? "medium",
      frame: o.frame ?? "",
      ...shuffleAttrs(o),
    },
  };
}

// ── Layout containers ────────────────────────────────────────────────
/** Full-bleed grid row — children place themselves on content columns.
 *  `align` sets vertical alignment of the cells (align-items). */
export function row(children: JsonNode[], o: { align?: "start" | "center" | "end" } = {}): JsonNode {
  return {
    type: "row",
    attrs: { shuffleStart: 1, shuffleEnd: 12, alignment: o.align ?? "", zIndex: 0 },
    content: children,
  };
}

/** Vertical stack within one grid column (flex column). `align` maps to
 *  `align-items`: the default (stretch) lets text/images fill the column;
 *  "start"/"center" size children to content — use it for a stack of pill
 *  buttons so they don't stretch edge to edge. */
export function container(
  o: Cols & { align?: "start" | "center" | "end" },
  children: JsonNode[],
): JsonNode {
  return {
    type: "container",
    attrs: { ...shuffleAttrs(o), alignment: o.align ?? "", zIndex: 0 },
    content: children,
  };
}

/** A content-sized stack of buttons inside a column (won't stretch). */
export function buttonStack(o: Cols & { align?: "start" | "center" | "end" }, buttons: JsonNode[]): JsonNode {
  return container({ ...o, align: o.align ?? "start" }, buttons);
}

export function card(
  o: Cols & { padding?: Size; radius?: "none" | "medium" | "large"; theme?: string },
  children: JsonNode[],
): JsonNode {
  return {
    type: "card",
    attrs: {
      padding: o.padding ?? "l",
      radius: o.radius ?? "large",
      theme: o.theme ?? "",
      image: "",
      overlay: "",
      ...shuffleAttrs(o),
    },
    content: children,
  };
}
