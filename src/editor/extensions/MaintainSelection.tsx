import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { Extension } from "../types";

interface Meta {
  action: "blur" | "focus";
}

const maintainSelectionKey = new PluginKey<DecorationSet>(
  "pp-maintain-selection",
);

export interface MaintainSelectionOptions {
  /** CSS class painted over the previously-selected range. Default: "pp-blur-selection". */
  className?: string;
}

/**
 * Preserves a visual highlight over the user's selection when the editor
 * loses focus (e.g., they click into a toolbar popover, link input,
 * comment, etc.). Without this, the native selection disappears the
 * moment focus moves out, leaving the user wondering where their
 * intended range was.
 */
export function createMaintainSelection({
  className = "pp-blur-selection",
}: MaintainSelectionOptions = {}) {
  return Extension.create({
    name: "maintain-selection",
    plugins: () => [
      new Plugin<DecorationSet>({
        key: maintainSelectionKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, old) {
            const meta = tr.getMeta(maintainSelectionKey) as Meta | undefined;
            if (meta?.action === "focus") return DecorationSet.empty;
            if (meta?.action === "blur") {
              const { from, to } = tr.selection;
              if (from === to) return DecorationSet.empty;
              return DecorationSet.create(tr.doc, [
                Decoration.inline(from, to, { class: className }),
              ]);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return maintainSelectionKey.getState(state) ?? null;
          },
          handleDOMEvents: {
            blur(view) {
              view.dispatch(
                view.state.tr.setMeta(maintainSelectionKey, {
                  action: "blur",
                } as Meta),
              );
              return false;
            },
            focus(view) {
              view.dispatch(
                view.state.tr.setMeta(maintainSelectionKey, {
                  action: "focus",
                } as Meta),
              );
              return false;
            },
          },
        },
      }),
    ],
    meta: { label: "Maintain selection", group: "system" },
  });
}

export const MaintainSelection = createMaintainSelection();
