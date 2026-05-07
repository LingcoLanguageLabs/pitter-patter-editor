import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import type { Node } from "prosemirror-model";
import type { EditorState } from "prosemirror-state";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  memo,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import { Extension } from "../types";

export type TocIndexer = (
  items: Omit<TocItem, "hierarchicalIndex">[],
) => string[];

/** Outline-style: each level resets, joined by dots. e.g. "1", "1.1", "1.2", "2". */
export const hierarchicalIndexer: TocIndexer = (items) => {
  const counters: number[] = [];
  return items.map((item) => {
    if (counters.length >= item.level) {
      // Same or shallower level — keep the counter at this level and bump it.
      counters.length = item.level;
      counters[item.level - 1] = (counters[item.level - 1] ?? 0) + 1;
    } else {
      // Going deeper — pad any skipped levels with 1, then start this level.
      while (counters.length < item.level - 1) counters.push(1);
      counters.push(1);
    }
    return counters.slice(0, item.level).join(".");
  });
};

/** Flat: 1, 2, 3 regardless of level. */
export const linearIndexer: TocIndexer = (items) =>
  items.map((_, i) => String(i + 1));

export interface TocItem {
  /** Slug used as the `data-toc-id` for click-to-scroll lookup. */
  id: string;
  /** Position of the heading node in the doc. */
  pos: number;
  /** End position (pos + node.nodeSize) of the heading node. */
  endPos: number;
  textContent: string;
  /** Raw heading level (h1=1 … h6=6). */
  originalLevel: number;
  /** Normalized depth in the TOC tree, 1-based. */
  level: number;
  /** "1.2.1"-style index reflecting the hierarchical position. */
  hierarchicalIndex: string;
  /** Flat 1-based index in the doc-order list. */
  itemIndex: number;
  /** True when the cursor is inside this heading. */
  isActive: boolean;
  /**
   * True when the heading has scrolled above the viewport top. Always false
   * unless `useTableOfContents` is given a `scrollContainer`, since scroll
   * tracking has a runtime cost we don't pay for free.
   */
  isScrolledOver: boolean;
}

export interface TableOfContentsState {
  items: TocItem[];
}

export const tocKey = new PluginKey<TableOfContentsState>("pp-toc");

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "section";
}

function findActiveHeadingPos(state: EditorState): number {
  const $from = state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === "heading") {
      return $from.before(d);
    }
  }
  return -1;
}

function computeItems(
  state: EditorState,
  getId: (text: string, node: Node) => string,
  getIndex: TocIndexer,
): TocItem[] {
  const headings: { node: Node; pos: number }[] = [];
  state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      headings.push({ node, pos });
      return false;
    }
    return undefined;
  });

  const levelStack: number[] = [];
  const usedSlugs = new Map<string, number>();
  const activeHeadingPos = findActiveHeadingPos(state);
  const partials: Omit<TocItem, "hierarchicalIndex">[] = [];

  for (const { node, pos } of headings) {
    const originalLevel = (node.attrs["level"] as number | undefined) ?? 1;

    while (
      levelStack.length > 0 &&
      (levelStack[levelStack.length - 1] ?? 0) >= originalLevel
    ) {
      levelStack.pop();
    }
    levelStack.push(originalLevel);
    const level = levelStack.length;

    const text = node.textContent;
    const baseSlug = getId(text, node);
    const seen = usedSlugs.get(baseSlug) ?? 0;
    usedSlugs.set(baseSlug, seen + 1);
    const id = seen > 0 ? `${baseSlug}-${seen + 1}` : baseSlug;

    const endPos = pos + node.nodeSize;
    const isActive = pos === activeHeadingPos;

    partials.push({
      id,
      pos,
      endPos,
      textContent: text,
      originalLevel,
      level,
      itemIndex: partials.length + 1,
      isActive,
      isScrolledOver: false,
    });
  }

  const indexes = getIndex(partials);
  return partials.map((item, i) => ({
    ...item,
    hierarchicalIndex: indexes[i] ?? "",
  }));
}

function recomputeActive(items: TocItem[], state: EditorState): TocItem[] | null {
  const activePos = findActiveHeadingPos(state);
  let changed = false;
  const next = items.map((item) => {
    const shouldBeActive = item.pos === activePos;
    if (item.isActive === shouldBeActive) return item;
    changed = true;
    return { ...item, isActive: shouldBeActive };
  });
  return changed ? next : null;
}

export interface TableOfContentsOptions {
  /**
   * Custom id generator. Default: slugify(text). Receives the heading text
   * and node so consumers can fall back to attrs (e.g., a UniqueID-stored
   * value) when present.
   */
  getId?: (text: string, node: Node) => string;
  /**
   * Indexer that produces the `hierarchicalIndex` for each item.
   * Default: `hierarchicalIndexer` ("1", "1.1", "1.2"). Pass `linearIndexer`
   * for flat numbering ("1", "2", "3") or your own function for custom
   * schemes (Roman numerals, alpha, etc.).
   */
  getIndex?: TocIndexer;
  /**
   * Called with the new items array on every doc/selection change. Useful
   * for non-React consumers (`useTableOfContents()` is the React-friendly
   * path).
   */
  onUpdate?: (items: TocItem[]) => void;
}

export function createTableOfContents({
  getId = (text) => slugify(text),
  getIndex = hierarchicalIndexer,
  onUpdate,
}: TableOfContentsOptions = {}) {
  return Extension.create({
    name: "table-of-contents",
    plugins: () => [
      new Plugin<TableOfContentsState>({
        key: tocKey,
        state: {
          init: (_, state) => ({ items: computeItems(state, getId, getIndex) }),
          apply: (tr, prev, _oldState, newState) => {
            if (tr.docChanged) {
              return { items: computeItems(newState, getId, getIndex) };
            }
            const next = recomputeActive(prev.items, newState);
            return next ? { items: next } : prev;
          },
        },
        props: {
          decorations(state) {
            const items = tocKey.getState(state)?.items ?? [];
            if (items.length === 0) return null;
            return DecorationSet.create(
              state.doc,
              items.map((item) =>
                // Use a separate `data-toc-id` rather than `id` so we don't
                // step on a host's existing id usage (e.g. UniqueID).
                // Click-to-scroll matches via `[data-toc-id="..."]`.
                Decoration.node(item.pos, item.endPos, {
                  "data-toc-id": item.id,
                  id: item.id,
                }),
              ),
            );
          },
        },
        view() {
          if (!onUpdate) return {};
          return {
            update(view, prevState) {
              const items = tocKey.getState(view.state)?.items;
              const prev = tocKey.getState(prevState)?.items;
              if (items && items !== prev) onUpdate(items);
            },
          };
        },
      }),
    ],
    meta: { label: "Table of contents", group: "system" },
  });
}

export const TableOfContents = createTableOfContents();

/** Hook returning the current `TocItem[]`. Empty array when the extension isn't installed. */
export function useTableOfContents(): TocItem[] {
  const state = useEditorState();
  if (!state) return [];
  return tocKey.getState(state)?.items ?? [];
}

/**
 * Tracks which TOC items have scrolled past the top of `container` (or the
 * window if not provided / `null`). Returns a Set of ids whose heading
 * elements are above the container's top edge. Recomputes on scroll and
 * resize; idle otherwise.
 */
export function useScrolledOverItems(
  items: TocItem[],
  container?: Element | Window | null,
): Set<string> {
  const [scrolledOver, setScrolledOver] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (items.length === 0) {
      setScrolledOver((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    const target = container ?? (typeof window !== "undefined" ? window : null);
    if (!target) return;

    const update = () => {
      const top =
        target instanceof Window
          ? 0
          : (target as Element).getBoundingClientRect().top;
      const next = new Set<string>();
      for (const item of items) {
        const el = document.querySelector<HTMLElement>(
          `[data-toc-id="${CSS.escape(item.id)}"]`,
        );
        if (!el) continue;
        if (el.getBoundingClientRect().top < top + 1) next.add(item.id);
      }
      setScrolledOver((prev) => {
        if (
          prev.size === next.size &&
          [...prev].every((id) => next.has(id))
        ) {
          return prev;
        }
        return next;
      });
    };

    update();
    target.addEventListener("scroll", update, { passive: true } as AddEventListenerOptions);
    window.addEventListener("resize", update);
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items, container]);

  return scrolledOver;
}

interface TableOfContentsViewProps {
  /**
   * Container to track scroll on. If omitted, falls back to `window`. Pass
   * `null` to disable scroll tracking entirely (`isScrolledOver` will stay
   * `false` for every item).
   */
  scrollContainer?: Element | Window | null;
  /**
   * Optional empty-state element when the doc has no headings. Defaults to a
   * simple "Add a heading…" hint.
   */
  emptyState?: ReactNode;
  /** Hide the leading number prefix ("1.", "1.", "2.") in front of each row. */
  hideNumbers?: boolean;
  className?: string;
}

/**
 * Drop-in sidebar view modeled on TipTap's TOC demo. Click an item to scroll
 * the heading into view, set the cursor inside it, and update the URL hash.
 * For custom layouts/styling, read the items via `useTableOfContents()` and
 * render your own.
 */
export const TableOfContentsView = memo(function TableOfContentsView({
  scrollContainer,
  emptyState,
  hideNumbers,
  className,
}: TableOfContentsViewProps = {}) {
  const items = useTableOfContents();
  const scrolledOver = useScrolledOverItems(items, scrollContainer);

  const onItemClick = useEditorEventCallback(
    (view, e: ReactMouseEvent<HTMLAnchorElement>, id: string) => {
      e.preventDefault();
      if (!view) return;
      const target = view.dom.querySelector<HTMLElement>(
        `[data-toc-id="${CSS.escape(id)}"]`,
      );
      if (!target) return;
      const pos = view.posAtDOM(target, 0);
      const tr = view.state.tr.setSelection(
        TextSelection.create(view.state.doc, pos),
      );
      view.dispatch(tr);
      view.focus();
      if (typeof history !== "undefined" && history.pushState) {
        history.pushState(null, "", `#${id}`);
      }
      // Match TipTap's behavior: scroll the window so embedded editors
      // inside an overflow:auto don't trap the scroll inside themselves.
      const rect = target.getBoundingClientRect();
      if (typeof window !== "undefined") {
        window.scrollTo({
          top: rect.top + window.scrollY,
          behavior: "smooth",
        });
      }
    },
  );

  if (items.length === 0) {
    return (
      <div className={className ? `pp-toc ${className}` : "pp-toc"}>
        {emptyState ?? (
          <p className="pp-toc-empty">Add a heading to start the outline.</p>
        )}
      </div>
    );
  }

  return (
    <div className={className ? `pp-toc ${className}` : "pp-toc"}>
      {items.map((item) => {
        const isScrolledOver = scrolledOver.has(item.id);
        const leafIndex = item.hierarchicalIndex.split(".").pop() ?? "";
        return (
          <div
            key={item.id}
            className={
              "pp-toc-item" +
              (item.isActive && !isScrolledOver ? " is-active" : "") +
              (isScrolledOver ? " is-scrolled-over" : "")
            }
            style={{ ["--level" as string]: item.level }}
          >
            <a
              href={`#${item.id}`}
              data-item-index={item.itemIndex}
              onClick={(e) => onItemClick(e, item.id)}
            >
              {!hideNumbers && (
                <span className="pp-toc-number">{leafIndex}.</span>
              )}
              <span className="pp-toc-text">{item.textContent}</span>
            </a>
          </div>
        );
      })}
    </div>
  );
});
