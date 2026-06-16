/**
 * "Scope" section for the Header / Footer settings popover — where a bar is
 * pinned global, detached to one page, or hidden. Lifted out of the bar's
 * on-canvas toolbar (now back to just Add block · settings · delete) so scope
 * lives with the bar's other settings, as a segmented control like every other
 * field in the popover.
 *
 *   Global    — the site-wide master, shown on every inheriting page
 *   This page — detached: a private copy this page can edit freely
 *   Hidden    — suppressed on this page (title/cover page)
 *
 * Switching segments maps onto the `headerFooter.ts` verbs (all act on the
 * ACTIVE page — the only one whose bar chrome you can open). Picking "Global"
 * from a detached bar INHERITS the existing master (non-destructive); a separate
 * "Make this the site-wide …" action promotes the page's own bar to the master
 * (the explicit, page-overwrites-everyone move). When no master exists yet,
 * "Global" promotes directly.
 */

"use client";

import { PushPin } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";

import { Segmented } from "./blockSettings/forms";
import {
  detachBar,
  globalBar,
  hideBar,
  isGlobalBarPos,
  makeBarGlobal,
  resetBarToGlobal,
  type BarKind,
} from "./headerFooter";
import { findEnclosingOfType } from "./sectionUtils";

type Scope = "global" | "page" | "hidden";

const OPTIONS: readonly { value: Scope; label: string }[] = [
  { value: "global", label: "Global" },
  { value: "page", label: "This page" },
  { value: "hidden", label: "Hidden" },
];

export function BarScopeField({
  kind,
  getPos,
  onClose,
}: {
  kind: BarKind;
  getPos: () => number;
  /** Closed after a scope change — the change swaps which bar node is shown
   *  (and may hide this one), so the popover, anchored to the old bar's gear,
   *  would otherwise dangle (and reposition to the corner). */
  onClose?: () => void;
}) {
  const state = useEditorState();
  const info = findEnclosingOfType(state, getPos(), [kind]);
  // The popover only opens on a VISIBLE bar, so the bar is global or a page
  // override — never "hidden" (a hidden bar has no chrome to open it from).
  const isGlobal = info ? isGlobalBarPos(state.doc, info.pos) : true;
  const hasMaster = !!globalBar(state.doc, kind);
  const label = kind === "header" ? "header" : "footer";
  const scope: Scope = isGlobal ? "global" : "page";

  const setScope = useEditorEventCallback((view, next: Scope) => {
    const here = findEnclosingOfType(view.state, getPos(), [kind]);
    const global = here ? isGlobalBarPos(view.state.doc, here.pos) : true;
    const current: Scope = global ? "global" : "page";
    if (next === current) return; // already there — no-op, keep popover open
    if (next === "hidden") {
      hideBar(view, kind);
    } else if (next === "page") {
      detachBar(view, kind);
    } else {
      // → Global from detached: inherit the existing master (safe), or — with
      // no master yet — promote this bar to become it.
      if (globalBar(view.state.doc, kind)) resetBarToGlobal(view, kind);
      else makeBarGlobal(view, kind);
    }
    onClose?.();
  });

  const promote = useEditorEventCallback((view) => {
    makeBarGlobal(view, kind);
    onClose?.();
  });

  return (
    <div className="pb-scope" data-scope={scope}>
      <span className="pb-field-label">Scope</span>
      <Segmented ariaLabel="Scope" value={scope} options={OPTIONS} onChange={setScope} />
      <p className="pb-scope-note">
        {scope === "global"
          ? `Shown on every page — editing changes this ${label} everywhere.`
          : `A custom ${label} for this page only.`}
      </p>
      {/* Promote a page's own bar to the site-wide master (overwrites it for
          every inheriting page) — the explicit "make global" move. */}
      {scope === "page" && hasMaster && (
        <button type="button" className="pb-scope-promote" onClick={promote}>
          <PushPin size={13} weight="fill" />
          <span>Make this the site-wide {label}</span>
        </button>
      )}
    </div>
  );
}
