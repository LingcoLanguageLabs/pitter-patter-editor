/**
 * Reproduces `@pitter-patter/shuffle`'s per-block grid layout WITHOUT
 * running ProseMirror — the crux of the static/published renderer.
 *
 * In the editor, shuffle adds a `Decoration.node` to every block at render
 * time: the column class `shuffle-block start-N end-N` (from the block's
 * `shuffleStart`/`shuffleEnd` attrs) and an inline `grid-row` / `z-index` /
 * `align-items` style. None of that is in the document — but it's a pure
 * function of the saved attrs plus the block's index among its siblings, so
 * the walker can recompute it. Logic mirrors `shuffle/src/plugin.ts` (the
 * `apply` decoration pass) and its `getShuffleGridClass` exactly.
 */

import type { CSSProperties } from "react";

/** PM document JSON — the serialized shape the renderer consumes (what a
 *  publish step would store), so nothing here depends on a live PM schema. */
export interface JsonNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** shuffle's column index → grid class name (0 → left, 13 → right, else N). */
export function getShuffleGridClass(col: number): string {
  if (col === 0) return "left";
  if (col === 13) return "right";
  return String(col);
}

/**
 * The classes + inline style shuffle would decorate `node` with, given its
 * `index` among its siblings. Rows get the grid-row/z/align style but no
 * `start-N end-N` class (their `start-left end-right` comes from the row's
 * own markup); every other block-group node (it carries `shuffleStart`/
 * `shuffleEnd`) gets both. Section/page/text — no shuffle attrs — get nothing.
 */
export function shuffleLayout(
  node: JsonNode,
  index: number,
): { className: string[]; style: CSSProperties } {
  const a = node.attrs ?? {};
  const isRow = node.type === "row";
  const hasColumns =
    typeof a["shuffleStart"] === "number" && typeof a["shuffleEnd"] === "number";

  const className: string[] = [];
  const style: CSSProperties = {};

  if (!isRow && hasColumns) {
    className.push(
      "shuffle-block",
      `start-${getShuffleGridClass(a["shuffleStart"] as number)}`,
      `end-${getShuffleGridClass(a["shuffleEnd"] as number)}`,
    );
  }

  if (isRow || hasColumns) {
    style.gridRow = index + 1;
    style.zIndex = (a["zIndex"] as number) ?? 0;
    if (a["alignment"]) style.alignItems = a["alignment"] as CSSProperties["alignItems"];
  }

  return { className, style };
}
