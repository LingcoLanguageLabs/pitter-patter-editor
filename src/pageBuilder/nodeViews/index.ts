/**
 * The `nodeViewComponents` map passed to `<ProseMirror>` in
 * `Editor.tsx`. Each entry maps a schema node name to its React
 * NodeView component. Keep one component per file in this folder
 * so the schema → view mapping is obvious at a glance.
 */

import { ButtonNodeView } from "./ButtonNodeView";
import { CardNodeView } from "./CardNodeView";
import { ImageNodeView } from "./ImageNodeView";
import { SectionNodeView } from "./SectionNodeView";

export const nodeViewComponents = {
  button: ButtonNodeView,
  card: CardNodeView,
  image: ImageNodeView,
  section: SectionNodeView,
};
