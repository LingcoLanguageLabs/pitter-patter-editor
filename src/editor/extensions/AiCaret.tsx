import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import { Extension } from "../types";

export interface AiCaretOptions {
  /** How long the caret stays after the most recent position update, in ms. */
  timeout?: number;
  /** Label rendered next to the caret (defaults to "AI"). */
  label?: string;
}

interface AiCaretState {
  decorations: DecorationSet;
  position: number | null;
}

export const aiCaretKey = new PluginKey<AiCaretState>("pp-ai-caret");

const SHOW_META = "pp-ai-caret-show";
const HIDE_META = "pp-ai-caret-hide";

function buildDecoration(pos: number, label: string): Decoration {
  const wrapper = document.createElement("span");
  wrapper.className = "pp-ai-caret";
  wrapper.setAttribute("aria-hidden", "true");
  const labelEl = document.createElement("span");
  labelEl.className = "pp-ai-caret__label";
  labelEl.textContent = label;
  wrapper.appendChild(labelEl);
  return Decoration.widget(pos, wrapper, { side: 1, key: "ai-caret" });
}

export function createAiCaret({
  timeout = 1500,
  label = "AI",
}: AiCaretOptions = {}) {
  return Extension.create({
    name: "ai-caret",
    plugins: () => [
      new Plugin<AiCaretState>({
        key: aiCaretKey,
        state: {
          init: (): AiCaretState => ({
            decorations: DecorationSet.empty,
            position: null,
          }),
          apply(tr, prev): AiCaretState {
            const showAt = tr.getMeta(SHOW_META) as number | undefined;
            const hide = tr.getMeta(HIDE_META) as boolean | undefined;
            if (hide) {
              return { decorations: DecorationSet.empty, position: null };
            }
            if (typeof showAt === "number") {
              const safe = Math.max(0, Math.min(showAt, tr.doc.content.size));
              return {
                decorations: DecorationSet.create(tr.doc, [
                  buildDecoration(safe, label),
                ]),
                position: safe,
              };
            }
            // Map forward across edits.
            if (prev.position == null) return prev;
            const mapped = tr.mapping.map(prev.position);
            return {
              decorations: prev.decorations.map(tr.mapping, tr.doc),
              position: mapped,
            };
          },
        },
        props: {
          decorations(state) {
            return aiCaretKey.getState(state)?.decorations ?? null;
          },
        },
        view(view) {
          let timer: number | null = null;
          const armTimer = () => {
            if (timer != null) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
              if (view.isDestroyed) return;
              view.dispatch(view.state.tr.setMeta(HIDE_META, true));
            }, timeout);
          };
          return {
            update(view, prev) {
              const cur = aiCaretKey.getState(view.state);
              const before = aiCaretKey.getState(prev);
              if (cur?.position != null && cur.position !== before?.position) {
                armTimer();
              }
              if (cur?.position == null && timer != null) {
                window.clearTimeout(timer);
                timer = null;
              }
            },
            destroy() {
              if (timer != null) window.clearTimeout(timer);
            },
          };
        },
      }),
    ],
    meta: { label: "AI caret", group: "system" },
  });
}

export const AiCaret = createAiCaret();

/** Show the AI caret at `pos`. Auto-hides after the configured timeout. */
export function showAiCaret(pos: number) {
  return (state: import("prosemirror-state").EditorState, dispatch?: (tr: import("prosemirror-state").Transaction) => void) => {
    if (!dispatch) return true;
    dispatch(state.tr.setMeta(SHOW_META, pos).setMeta("addToHistory", false));
    return true;
  };
}

/** Hide the AI caret immediately. */
export function hideAiCaret() {
  return (state: import("prosemirror-state").EditorState, dispatch?: (tr: import("prosemirror-state").Transaction) => void) => {
    if (!dispatch) return true;
    dispatch(state.tr.setMeta(HIDE_META, true).setMeta("addToHistory", false));
    return true;
  };
}
