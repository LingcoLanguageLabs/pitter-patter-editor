/**
 * Active-section selection + its highlight ring — the section-level
 * companion to `blockHighlightPlugin`. Sections aren't shuffle blocks
 * (see `schema.ts`: "shuffle out of it"), so the block plugin never
 * touches them; this keeps the parallel "which section is active" state
 * and paints the same accent ring one level up.
 *
 *   • mousedown anywhere inside a `.pp-section` makes it the active
 *     section — whether the click lands on a block or in the section's
 *     own padding/gutter. The block ring (blockHighlightPlugin) is
 *     independent, so clicking a block shows BOTH rings, mirroring
 *     pagy (the section outline plus the inner block outline).
 *   • a plain click in the editor but outside any section (the page
 *     gutter), a click fully outside the editor + its portaled UI, or
 *     Escape clears it.
 *   • a shuffle drag clears it and keeps it cleared past the drop, until
 *     the next click — same as the block ring.
 *
 * Everything that should track "the active section" reads
 * `getActiveSectionPos`. Today that's just this plugin's own decoration;
 * it's exported so the section toolbar / settings popover can key off it
 * later (e.g. stay shown while the section is active, not only on hover).
 *
 * The ring is a single CSS rule (`.pb-section-active::after`) mirroring
 * the block ring (`.pb-block-active::after`) — pagy's one `.highlight`
 * surfaced through a state-modifier class.
 */

import {
  Plugin,
  PluginKey,
  type EditorState,
  type Transaction,
} from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";
import { shufflePluginKey } from "@pitter-patter/shuffle";

import { findEnclosingSection } from "./sectionUtils";

interface SectionHighlightState {
  /** Doc position (before-node) of the active section, or null. */
  activePos: number | null;
}

type SectionHighlightMeta = { activePos: number | null };

export const sectionHighlightKey = new PluginKey<SectionHighlightState>(
  "pb-section-highlight",
);

/** Doc position (before-node) of the active section, or null when none
 *  is active (clicked off / Escape / mid-drag). */
export function getActiveSectionPos(state: EditorState): number | null {
  return sectionHighlightKey.getState(state)?.activePos ?? null;
}

/** Set the active section to the section node starting at `pos`, or
 *  clear with `null`. */
export function selectSectionPos(view: EditorView, pos: number | null): void {
  view.dispatch(
    view.state.tr.setMeta(sectionHighlightKey, {
      activePos: pos,
    } as SectionHighlightMeta),
  );
}

/** Stamp `tr` so the active section points at `pos` after the
 *  transaction applies — the meta wins over `apply`'s position mapping.
 *  Pass a post-transaction position. */
export function setActiveSection(
  tr: Transaction,
  pos: number | null,
): Transaction {
  return tr.setMeta(sectionHighlightKey, {
    activePos: pos,
  } as SectionHighlightMeta);
}

/** Clicks on these keep the ring alive — section UI that portals out of
 *  the editor DOM (settings popover reuses `.pb-block-settings`; the
 *  Add-block menu is `.pb-block-picker`), so a plain outside-click check
 *  would otherwise read interacting with them as a "click off". */
const KEEP_ALIVE_SELECTOR =
  ".pb-block-settings, .pb-block-picker, .pb-context-menu, [data-radix-popper-content-wrapper]";

export function sectionHighlightPlugin() {
  return new Plugin<SectionHighlightState>({
    key: sectionHighlightKey,
    state: {
      init: () => ({ activePos: null }),
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(sectionHighlightKey) as
          | SectionHighlightMeta
          | undefined;
        let activePos = meta ? meta.activePos : value.activePos;
        // Keep the ring glued to its section across edits.
        if (!meta && activePos != null && tr.docChanged) {
          const result = tr.mapping.mapResult(activePos);
          activePos = result.deleted ? null : result.pos;
        }
        // Drop the ring if the mapped position no longer starts a section
        // (merged / replaced / deleted out from under us).
        if (activePos != null) {
          const node = newState.doc.nodeAt(activePos);
          if (!node || node.type.name !== "section") activePos = null;
        }
        // A shuffle drag clears the ring and keeps it cleared past the
        // drop (until the next click) — mirrors the block ring + pagy.
        if (shufflePluginKey.getState(newState)?.activeNodePos != null) {
          activePos = null;
        }
        return { activePos };
      },
    },
    props: {
      decorations(state) {
        const pos = getActiveSectionPos(state);
        if (pos == null) return DecorationSet.empty;
        const node = state.doc.nodeAt(pos);
        if (!node) return DecorationSet.empty;
        return DecorationSet.create(state.doc, [
          Decoration.node(pos, pos + node.nodeSize, {
            class: "pb-section-active",
          }),
        ]);
      },
    },
    view(editorView) {
      const setActive = (pos: number | null) => {
        if (getActiveSectionPos(editorView.state) === pos) return;
        editorView.dispatch(
          editorView.state.tr.setMeta(sectionHighlightKey, {
            activePos: pos,
          } as SectionHighlightMeta),
        );
      };

      // Activate the clicked section. Listen on `mousedown` (like the
      // block plugin) so the ring lands on the same gesture that places
      // the caret. We don't preventDefault/blur here — the section ring
      // is purely a visual layer; the block plugin owns caret/gutter
      // behavior.
      const onMouseDown = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const sectionEl = target?.closest(".pp-section") as
          | (HTMLElement & { pmViewDesc?: { posBefore: number } })
          | null;
        if (!sectionEl) {
          // Clicked inside the editor but outside any section (the page
          // gutter) — clear on a plain click; leave right-clicks alone so
          // a native menu can open without dropping the ring.
          if (event.button === 0) setActive(null);
          return;
        }
        // `posBefore` off the section's NodeView DOM is the section's
        // own position. Fall back to resolving the enclosing section
        // from a DOM-derived position if the desc isn't attached.
        const desc = sectionEl.pmViewDesc;
        if (desc) {
          setActive(desc.posBefore);
          return;
        }
        const inside = editorView.posAtDOM(sectionEl, 0);
        const info = findEnclosingSection(editorView.state, inside);
        setActive(info ? info.pos : null);
      };

      // Clicks fully outside the editor clear the ring, unless they land
      // on section UI that portals out of the editor DOM.
      const onClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (editorView.dom.contains(target)) return;
        if (target.closest(KEEP_ALIVE_SELECTOR)) return;
        setActive(null);
      };

      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") setActive(null);
      };

      editorView.dom.addEventListener("mousedown", onMouseDown);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey);
      return {
        destroy() {
          editorView.dom.removeEventListener("mousedown", onMouseDown);
          document.removeEventListener("click", onClick, true);
          document.removeEventListener("keydown", onKey);
        },
      };
    },
  });
}
