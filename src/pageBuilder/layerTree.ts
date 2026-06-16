/**
 * Layer tree — a flat, Figma-style serialization of the whole document for
 * the Layers panel. The deck (`page+`) becomes a depth-ordered list:
 *
 *   page → (header? section+ footer?) → block+ → nested card/container/row → leaf
 *
 * Built fresh from the doc on every change (by `editorStoreSyncPlugin`) and
 * mirrored into the store, since the panel lives outside the ProseMirror React
 * context. The panel renders it, honoring collapse state, and dispatches
 * select / move / rename through the stashed `pagesView`.
 *
 * Keys are PATH-based — the page level uses the page's stable `id`; deeper
 * levels are `{pageId}/{idx}/{idx}…`. Unlike absolute doc positions (which
 * shift on any upstream edit), a path key is stable for React reconciliation +
 * collapse-state persistence and, crucially, independent of edits on *other*
 * pages. The live `pos` carried alongside is what the move/select commands act
 * on — it's re-derived every transaction, so it's always current at drop time.
 */

import type { Node as PmNode } from "prosemirror-model";

import { pageList } from "./activePagePlugin";
import { globalBar } from "./headerFooter";

/** Node types that can hold child layers (so the tree recurses into them and
 *  they can be drop targets). Everything else (text blocks, atoms) is a leaf. */
const CONTAINER_TYPES = new Set([
  "page",
  "section",
  "header",
  "footer",
  "card",
  "container",
  "row",
]);

/** Structural full-width nodes — locked from dragging in the tree (their
 *  position in a page is schema-fixed: header first, footer last). Their
 *  children still drag freely. */
const STRUCTURAL_TYPES = new Set(["header", "footer"]);

export interface LayerNode {
  /** Stable identity (page id, or `{pageId}/{idx}…`). React key + dnd id. */
  key: string;
  /** Parent's key, or null for page rows. */
  parentKey: string | null;
  /** Live doc position (before-node). The commands act on this. */
  pos: number;
  /** ProseMirror node type name. */
  type: string;
  /** Display label (custom `name` attr if set, else a derived default). */
  label: string;
  /** Heading level (1–4) for picking the right icon; null for other types. */
  level: number | null;
  /** The raw renamable value — page title, or the node's `name` attr ("" when
   *  unnamed) — used to seed the inline rename input. */
  rawName: string;
  /** Nesting depth (page = 0). */
  depth: number;
  /** Id of the page this node lives on (the page's own id for page rows). */
  pageId: string;
  /** Index within the parent's children. */
  childIndex: number;
  /** True when this node has child layers. */
  hasChildren: boolean;
  /** True when this node can accept children (a drop target). */
  isContainer: boolean;
  /** Whether this row may be dragged (header/footer locked in v1). */
  canDrag: boolean;
  /** True for the doc-level site-wide header/footer masters (depth 0, no page),
   *  so the panel can flag them (purple pin) and the renderer treats them as
   *  shared chrome rather than page content. */
  isGlobalBar?: boolean;
}

function filename(src: string): string {
  if (!src) return "";
  const clean = src.split("?")[0]!.split("#")[0]!;
  return clean.split("/").pop() || "";
}

function truncate(s: string, n = 32): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** The renamable value behind a layer: a page's title, else the node's custom
 *  `name` attr ("" when never named). */
export function layerRawName(node: PmNode): string {
  if (node.type.name === "page") return (node.attrs["title"] as string) || "";
  return ((node.attrs["name"] as string) || "").trim();
}

/** A layer's display label: the custom name when set, else a type-derived
 *  default (heading text, button label, media filename, …). */
export function layerLabel(node: PmNode): string {
  const a = node.attrs;
  const type = node.type.name;
  if (type === "page") return (a["title"] as string) || "Untitled";
  const custom = ((a["name"] as string) || "").trim();
  if (custom) return custom;
  switch (type) {
    case "section":
      return (a["htmlId"] as string) ? `#${a["htmlId"]}` : "Section";
    case "header":
      return "Header";
    case "footer":
      return "Footer";
    case "card":
      return "Card";
    case "container":
      return "Container";
    case "row":
      return "Row";
    case "heading":
      return truncate(node.textContent) || `Heading ${a["level"] ?? 1}`;
    case "paragraph":
      return truncate(node.textContent) || "Text";
    case "button":
      return (a["label"] as string) || "Button";
    case "image":
      return filename(a["src"] as string) || "Image";
    case "video":
      return filename(a["src"] as string) || "Video";
    case "audio":
      return filename(a["src"] as string) || "Audio";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

/** Walk a container node's children, pushing a LayerNode for each (and
 *  recursing into nested containers). */
function walk(
  parent: PmNode,
  parentPos: number,
  depth: number,
  parentKey: string,
  pageId: string,
  out: LayerNode[],
): void {
  const contentStart = parentPos + 1;
  parent.forEach((child, offset, index) => {
    const pos = contentStart + offset;
    const key = `${parentKey}/${index}`;
    const isContainer = CONTAINER_TYPES.has(child.type.name);
    out.push({
      key,
      parentKey,
      pos,
      type: child.type.name,
      label: layerLabel(child),
      level:
        child.type.name === "heading"
          ? ((child.attrs["level"] as number) ?? 1)
          : null,
      rawName: layerRawName(child),
      depth,
      pageId,
      childIndex: index,
      hasChildren: isContainer && child.childCount > 0,
      isContainer,
      canDrag: !STRUCTURAL_TYPES.has(child.type.name),
    });
    if (isContainer) walk(child, pos, depth + 1, key, pageId, out);
  });
}

/** A doc-level site-wide bar (header / footer master) as a depth-0 layer, then
 *  its children walked in. These bookend the page rows: header at the top of
 *  the tree, footer at the bottom — mirroring the doc's `header? page+ footer?`
 *  order. No page (pageId ""); locked from dragging (their slot is fixed). */
function pushGlobalBar(doc: PmNode, kind: "header" | "footer", out: LayerNode[]): void {
  const g = globalBar(doc, kind);
  if (!g) return;
  const key = `global-${kind}`;
  out.push({
    key,
    parentKey: null,
    pos: g.pos,
    type: kind,
    label: layerLabel(g.node),
    level: null,
    rawName: layerRawName(g.node),
    depth: 0,
    pageId: "",
    childIndex: 0,
    hasChildren: g.node.childCount > 0,
    isContainer: true,
    canDrag: false,
    isGlobalBar: true,
  });
  walk(g.node, g.pos, 1, key, "", out);
}

/** Build the full, depth-ordered layer list for the deck. */
export function buildLayerTree(doc: PmNode): LayerNode[] {
  const out: LayerNode[] = [];
  pushGlobalBar(doc, "header", out);
  pageList(doc).forEach((page, pageIndex) => {
    const key = page.id || `page@${page.pos}`;
    out.push({
      key,
      parentKey: null,
      pos: page.pos,
      type: "page",
      label: layerLabel(page.node),
      level: null,
      rawName: layerRawName(page.node),
      depth: 0,
      pageId: page.id,
      childIndex: pageIndex,
      hasChildren: page.node.childCount > 0,
      isContainer: true,
      canDrag: true,
    });
    walk(page.node, page.pos, 1, key, page.id, out);
  });
  pushGlobalBar(doc, "footer", out);
  return out;
}
