/**
 * The `nodeViewComponents` map passed to `<ProseMirror>` in
 * `Editor.tsx`. Each entry maps a schema node name to its React
 * NodeView component. Keep one component per file in this folder
 * so the schema → view mapping is obvious at a glance.
 */

import { itemNodeViews } from "../items/registry";
import {
  AccordionHeaderView,
  AccordionItemView,
  AccordionPanelView,
  AccordionView,
} from "./AccordionNodeView";
import { AudioNodeView } from "./AudioNodeView";
import { ButtonNodeView } from "./ButtonNodeView";
import { CardNodeView } from "./CardNodeView";
import { DividerNodeView } from "./DividerNodeView";
import { EmbedNodeView } from "./EmbedNodeView";
import { FooterNodeView } from "./FooterNodeView";
import { HeaderNodeView } from "./HeaderNodeView";
import { ImageNodeView } from "./ImageNodeView";
import { PageNodeView } from "./PageNodeView";
import { ProgressNodeView } from "./ProgressNodeView";
import { SectionNodeView } from "./SectionNodeView";
import {
  TabLabelView,
  TabPanelView,
  TabsView,
  TabView,
} from "./TabsNodeView";
import { VectorNodeView } from "./VectorNodeView";
import { VideoNodeView } from "./VideoNodeView";

export const nodeViewComponents = {
  accordion: AccordionView,
  accordion_item: AccordionItemView,
  accordion_header: AccordionHeaderView,
  accordion_panel: AccordionPanelView,
  audio: AudioNodeView,
  button: ButtonNodeView,
  card: CardNodeView,
  divider: DividerNodeView,
  embed: EmbedNodeView,
  footer: FooterNodeView,
  header: HeaderNodeView,
  image: ImageNodeView,
  page: PageNodeView,
  progress: ProgressNodeView,
  section: SectionNodeView,
  tabs: TabsView,
  tab: TabView,
  tab_label: TabLabelView,
  tab_panel: TabPanelView,
  vector: VectorNodeView,
  video: VideoNodeView,
  // Learning-item builder views (mc, mc_prompt, mc_option, …) — one map entry
  // per node, contributed by each registered item type.
  ...itemNodeViews(),
};
