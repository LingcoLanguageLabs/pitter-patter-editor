import { Eye } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import type { Node as PmNode } from "prosemirror-model";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

export const invisibleCharsKey = new PluginKey<boolean>("pp-invisible-chars");

function buildDecorations(doc: PmNode): DecorationSet {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " ") {
          decos.push(
            Decoration.inline(pos + i, pos + i + 1, {
              class: "pp-inv-space",
            }),
          );
        } else if (ch === "\t") {
          decos.push(
            Decoration.inline(pos + i, pos + i + 1, {
              class: "pp-inv-tab",
            }),
          );
        }
      }
      return;
    }
    // Pilcrow at end of each textblock with content; line break for hard_break.
    if (node.isTextblock && node.content.size > 0) {
      const widget = document.createElement("span");
      widget.className = "pp-inv-pilcrow";
      widget.setAttribute("aria-hidden", "true");
      widget.textContent = "¶";
      decos.push(
        Decoration.widget(pos + node.nodeSize - 1, widget, { side: 1 }),
      );
    }
    if (node.type.name === "hard_break") {
      const widget = document.createElement("span");
      widget.className = "pp-inv-break";
      widget.setAttribute("aria-hidden", "true");
      widget.textContent = "↵";
      decos.push(Decoration.widget(pos, widget, { side: -1 }));
    }
  });
  return DecorationSet.create(doc, decos);
}

export interface InvisibleCharactersOptions {
  /** Initial visibility on editor mount. Default: false. */
  defaultVisible?: boolean;
}

export function createInvisibleCharacters({
  defaultVisible = false,
}: InvisibleCharactersOptions = {}) {
  return Extension.create({
    name: "invisible-characters",
    plugins: () => [
      new Plugin<boolean>({
        key: invisibleCharsKey,
        state: {
          init: () => defaultVisible,
          apply(tr, prev) {
            const meta = tr.getMeta(invisibleCharsKey);
            if (typeof meta === "boolean") return meta;
            return prev;
          },
        },
        props: {
          decorations(state) {
            const visible = invisibleCharsKey.getState(state) ?? false;
            if (!visible) return null;
            return buildDecorations(state.doc);
          },
        },
      }),
    ],
    toolbar: InvisibleCharactersToolbarItem,
    meta: { label: "Show invisibles", group: "system", Icon: Eye },
  });
}

export const InvisibleCharacters = createInvisibleCharacters();

function InvisibleCharactersToolbarItem() {
  const editorState = useEditorState();
  const visible = editorState
    ? (invisibleCharsKey.getState(editorState) ?? false)
    : false;

  const toggle = useEditorEventCallback((view) => {
    if (!view) return;
    const cur = invisibleCharsKey.getState(view.state) ?? false;
    view.dispatch(
      view.state.tr
        .setMeta(invisibleCharsKey, !cur)
        .setMeta("addToHistory", false),
    );
  });

  return (
    <MenuItem
      onClick={toggle}
      active={visible}
      tooltip={visible ? "Hide invisible characters" : "Show invisible characters"}
    >
      <Eye size={18} weight="bold" />
    </MenuItem>
  );
}
