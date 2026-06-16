/**
 * The `nodeViewComponents` map passed to `<ProseMirror>` in
 * `Editor.tsx`. Each entry maps a schema node name to its React
 * NodeView component. Keep one component per file in this folder
 * so the schema → view mapping is obvious at a glance.
 */

import { AudioNodeView } from "./AudioNodeView";
import { ButtonNodeView } from "./ButtonNodeView";
import { CardNodeView } from "./CardNodeView";
import { FooterNodeView } from "./FooterNodeView";
import { HeaderNodeView } from "./HeaderNodeView";
import { ImageNodeView } from "./ImageNodeView";
import { PageNodeView } from "./PageNodeView";
import { SectionNodeView } from "./SectionNodeView";
import { VideoNodeView } from "./VideoNodeView";

export const nodeViewComponents = {
  audio: AudioNodeView,
  button: ButtonNodeView,
  card: CardNodeView,
  footer: FooterNodeView,
  header: HeaderNodeView,
  image: ImageNodeView,
  page: PageNodeView,
  section: SectionNodeView,
  video: VideoNodeView,
};
