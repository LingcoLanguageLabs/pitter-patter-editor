/**
 * Restore ghost — the re-entry point for a page that HID its global header /
 * footer. A hidden bar renders nothing, so its normal chrome is gone too; this
 * slim dashed strip takes its place at the active page's top (header) / bottom
 * (footer), labelled "Global header hidden", with a Show action that clears the
 * page's hide flag so the master comes back.
 *
 * Mounted by `globalBarPlugin` as a PM widget decoration (only when the active
 * page is in the "hidden" state and a master exists to restore). Purple-tinted,
 * matching the global-element accent used everywhere these masters appear.
 */

"use client";

import { Eye } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  type WidgetViewComponentProps,
} from "@handlewithcare/react-prosemirror";
import { forwardRef } from "react";

import { showBar, type BarKind } from "./headerFooter";

const GlobalBarRestore = forwardRef<
  HTMLDivElement,
  WidgetViewComponentProps & { kind: BarKind }
>(function GlobalBarRestore({ kind, getPos: _getPos, widget: _widget, ...rest }, ref) {
  const show = useEditorEventCallback((view) => showBar(view, kind));
  const label = kind === "header" ? "Global header" : "Global footer";
  return (
    <div ref={ref} {...rest} className="pb-global-ghost" contentEditable={false}>
      <span className="pb-global-ghost-label">{label} hidden on this page</span>
      <button type="button" className="pb-global-ghost-show" onClick={show}>
        <Eye size={13} weight="bold" />
        <span>Show</span>
      </button>
    </div>
  );
});

/** Concrete per-kind widgets (react-prosemirror widget components take no
 *  custom props, so we bind `kind` here). */
export const HeaderRestoreGhost = forwardRef<HTMLDivElement, WidgetViewComponentProps>(
  function HeaderRestoreGhost(props, ref) {
    return <GlobalBarRestore ref={ref} kind="header" {...props} />;
  },
);

export const FooterRestoreGhost = forwardRef<HTMLDivElement, WidgetViewComponentProps>(
  function FooterRestoreGhost(props, ref) {
    return <GlobalBarRestore ref={ref} kind="footer" {...props} />;
  },
);
