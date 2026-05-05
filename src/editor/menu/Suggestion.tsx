import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  type Placement,
  type VirtualElement,
} from "@floating-ui/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SuggestionState {
  active: boolean;
  query: string;
  range: { from: number; to: number };
}

const INACTIVE: SuggestionState = {
  active: false,
  query: "",
  range: { from: -1, to: -1 },
};

export interface SuggestionPluginConfig {
  /** Trigger character (e.g. "/", "@", ":"). */
  char: string;
  /** Allow spaces inside the query (e.g. for `@John Doe`). Default: false. */
  allowSpaces?: boolean;
  /** Only fire if the trigger is at the start of a line. Default: false. */
  startOfLine?: boolean;
}

export function createSuggestionPlugin(config: SuggestionPluginConfig): {
  plugin: Plugin<SuggestionState>;
  key: PluginKey<SuggestionState>;
} {
  const key = new PluginKey<SuggestionState>(`suggestion-${config.char}`);
  const plugin = new Plugin<SuggestionState>({
    key,
    state: {
      init: () => INACTIVE,
      apply(tr, _prev, _oldState, newState) {
        if (tr.getMeta(key)?.close) return INACTIVE;
        const { selection } = newState;
        if (!selection.empty) return INACTIVE;

        const $cursor = selection.$from;
        const textBefore = $cursor.parent.textBetween(0, $cursor.parentOffset);
        const triggerIdx = textBefore.lastIndexOf(config.char);
        if (triggerIdx === -1) return INACTIVE;

        const charBefore = triggerIdx > 0 ? textBefore[triggerIdx - 1]! : "";
        if (charBefore && /\w/.test(charBefore)) return INACTIVE;
        if (config.startOfLine && triggerIdx !== 0) return INACTIVE;

        const query = textBefore.slice(triggerIdx + 1);
        if (!config.allowSpaces && /\s/.test(query)) return INACTIVE;
        if (query.length > 100) return INACTIVE;

        const triggerPos = $cursor.start() + triggerIdx;
        return {
          active: true,
          query,
          range: { from: triggerPos, to: $cursor.pos },
        };
      },
    },
  });
  return { plugin, key };
}

export interface SuggestionSelectContext<TItem> {
  view: EditorView;
  range: { from: number; to: number };
  item: TItem;
}

export interface SuggestionPopoverProps<TItem> {
  pluginKey: PluginKey<SuggestionState>;
  items: (query: string) => TItem[] | Promise<TItem[]>;
  onSelect: (ctx: SuggestionSelectContext<TItem>) => void;
  renderItem: (args: { item: TItem; isSelected: boolean }) => ReactNode;
  emptyState?: ReactNode;
  placement?: Placement;
  className?: string;
}

export function SuggestionPopover<TItem>({
  pluginKey,
  items: itemsFn,
  onSelect,
  renderItem,
  emptyState,
  placement = "bottom-start",
  className,
}: SuggestionPopoverProps<TItem>) {
  const editorState = useEditorState();
  const pluginState = editorState
    ? pluginKey.getState(editorState as EditorState) ?? INACTIVE
    : INACTIVE;
  const { active, query, range } = pluginState;

  const [items, setItems] = useState<TItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const rectRef = useRef<DOMRect>(new DOMRect(0, 0, 0, 0));

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.resolve(itemsFn(query)).then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => {
      cancelled = true;
    };
  }, [active, query, itemsFn]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query, items.length]);

  const virtualEl = useMemo<VirtualElement>(
    () => ({ getBoundingClientRect: () => rectRef.current }),
    [],
  );

  const { refs, floatingStyles, update } = useFloating({
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    refs.setReference(virtualEl);
  }, [refs, virtualEl]);

  useEditorEffect(
    (view) => {
      if (!active) return;
      const start = view.coordsAtPos(range.from);
      const end = view.coordsAtPos(range.to);
      rectRef.current = new DOMRect(
        Math.min(start.left, end.left),
        Math.min(start.top, end.top),
        Math.abs(end.right - start.left) || 1,
        Math.max(end.bottom - start.bottom, 16),
      );
      update();
    },
    [active, range.from, range.to, update],
  );

  const select = useEditorEventCallback((view, idx: number) => {
    if (!view) return;
    const item = items[idx];
    if (item == null) return;
    onSelect({ view, range, item });
  });

  const close = useEditorEventCallback((view) => {
    if (!view) return;
    const tr = view.state.tr.setMeta(pluginKey, { close: true });
    view.dispatch(tr);
  });

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (items.length > 0) {
          setSelectedIdx((i) => (i + 1) % items.length);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (items.length > 0) {
          setSelectedIdx((i) => (i - 1 + items.length) % items.length);
        }
      } else if (e.key === "Enter") {
        if (items.length === 0) return;
        e.preventDefault();
        select(selectedIdx);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [active, items, selectedIdx, select, close]);

  if (!active) return null;

  return createPortal(
    <div
      ref={refs.setFloating}
      className={["pp-suggestion", className].filter(Boolean).join(" ")}
      style={floatingStyles}
      role="listbox"
    >
      {items.length === 0
        ? emptyState ?? <div className="pp-suggestion-empty">No results</div>
        : items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              role="option"
              aria-selected={idx === selectedIdx}
              data-active={idx === selectedIdx || undefined}
              className="pp-suggestion-item"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setSelectedIdx(idx)}
              onClick={() => select(idx)}
            >
              {renderItem({ item, isSelected: idx === selectedIdx })}
            </button>
          ))}
    </div>,
    document.body,
  );
}
