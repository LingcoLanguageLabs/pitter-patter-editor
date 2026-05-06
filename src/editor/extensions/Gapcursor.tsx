import { gapCursor } from "prosemirror-gapcursor";

import { Extension } from "../types";

import "prosemirror-gapcursor/style/gapcursor.css";

/**
 * Lets the user place the cursor between or around block-only nodes
 * (e.g. between two stacked images, after a table, before the first node
 * if it's a horizontal rule). Without this, those positions are
 * unreachable and arrow-key navigation just stops.
 */
export const Gapcursor = Extension.create({
  name: "gapcursor",
  plugins: () => [gapCursor()],
  meta: { label: "Gap cursor", group: "system" },
});
