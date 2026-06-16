/**
 * ProseMirror plugin that renders the section affordance chrome as
 * a React widget decoration at each section's end-of-content
 * position. Using a widget (rather than a non-PM DOM child of the
 * section's contentDOM) keeps the chrome opaque to PM's
 * `posAtCoords` — which is what shuffle calls when computing drop
 * targets. Without this, shuffle's drop math gets confused by the
 * chrome's pills and lands the dragged block at the wrong gap.
 *
 * `side: 1` places the widget AFTER any content at the same
 * position, so for each section the widget renders as the last
 * child of the section's DOM. CSS positions the chrome
 * `position: absolute; inset: 0` so it overlays the section
 * regardless of being last in DOM order.
 */

import { Plugin, type EditorState } from "prosemirror-state";
import { DecorationSet } from "prosemirror-view";
import { widget } from "@handlewithcare/react-prosemirror";

import { HeaderFooterChromeWidget } from "./HeaderFooterChromeWidget";
import { SectionBackgroundWidget } from "./SectionBackgroundWidget";
import { SectionChromeWidget } from "./SectionChromeWidget";

function buildDecorations(state: EditorState) {
  const decos: ReturnType<typeof widget>[] = [];
  state.doc.descendants((node, pos) => {
    const name = node.type.name;
    if (name === "section") {
      // Background media layer at start-of-content (before the first
      // block), so it paints under everything. Same PM-opaque widget
      // trick as the chrome — a raw DOM child would confuse shuffle.
      decos.push(
        widget(pos + 1, SectionBackgroundWidget, {
          side: -1,
          key: `section-bg-${pos}`,
          ignoreSelection: true,
        }),
      );
      // Place the widget at the section's end-of-content position
      // (just inside the closing tag).
      const endOfContent = pos + node.nodeSize - 1;
      decos.push(
        widget(endOfContent, SectionChromeWidget, {
          side: 1,
          key: `section-chrome-${pos}`,
          // Make sure clicks / hovers on the chrome don't bubble into
          // PM as "user is interacting with content".
          ignoreSelection: true,
        }),
      );
      return false;
    }
    // Header + footer get the leaner bar chrome (Add block · settings · delete)
    // via the same end-of-content widget-decoration trick.
    if (name === "header" || name === "footer") {
      const endOfContent = pos + node.nodeSize - 1;
      decos.push(
        widget(endOfContent, HeaderFooterChromeWidget, {
          side: 1,
          key: `hf-chrome-${pos}`,
          ignoreSelection: true,
        }),
      );
      return false;
    }
    return true;
  });
  return DecorationSet.create(state.doc, decos);
}

export function sectionChromePlugin() {
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
