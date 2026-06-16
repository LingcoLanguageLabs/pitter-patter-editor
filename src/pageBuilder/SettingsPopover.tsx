/**
 * Shared shell for the structural-node settings popovers (Section, Header,
 * Footer). It owns everything those panels have in common — @floating-ui
 * anchoring to the toolbar gear, light-dismiss (outside pointerdown / Escape,
 * but NOT clicks inside a portaled Radix popper like a preset dropdown), the
 * portal, and the header/title chrome — so each concrete panel is just its
 * field list.
 *
 * The node it edits is resolved fresh from `getPos()` on every render +
 * dispatch (positions shift as the doc changes), looked up by `typeNames`
 * (e.g. ["section"], ["header"]). The render-prop receives that node's live
 * attrs plus a `setAttr` that writes straight back via `setNodeAttribute` —
 * no save button, same live-update model across all three panels.
 */

"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import type { Node as PmNode } from "prosemirror-model";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { findEnclosingOfType } from "./sectionUtils";

export function SettingsPopover({
  anchor,
  getPos,
  onClose,
  typeNames,
  title,
  children,
}: {
  /** The toolbar gear button the popover is anchored to. */
  anchor: HTMLElement | null;
  /** A position inside the target node (the chrome widget's `getPos`). */
  getPos: () => number;
  onClose: () => void;
  /** Node type(s) to resolve upward from `getPos` (e.g. ["header"]). */
  typeNames: readonly string[];
  /** Panel title shown in the header. */
  title: string;
  /** Field list, given the resolved node, a setter that writes its attrs, and
   *  the node's doc position (for panels that validate against siblings). */
  children: (
    node: PmNode,
    setAttr: (name: string, value: unknown) => void,
    pos: number,
  ) => ReactNode;
}) {
  const editorState = useEditorState();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const { x, y, strategy, refs } = useFloating({
    placement: "bottom-end",
    middleware: [offset(8), flip(), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    refs.setReference(anchor);
  }, [anchor, refs]);

  // Light-dismiss: pointerdown outside the popover + gear, or Escape.
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (popoverRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return; // gear toggles itself
      // A preset dropdown (the Spacing control) is a Radix popper portaled
      // outside the popover; a click inside it must not dismiss — that would
      // tear the popover down before the menu item's onSelect runs.
      if (
        target instanceof Element &&
        target.closest("[data-radix-popper-content-wrapper]")
      )
        return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  const setAttr = useEditorEventCallback(
    (view, name: string, value: unknown) => {
      const info = findEnclosingOfType(view.state, getPos(), typeNames);
      if (!info) return;
      view.dispatch(view.state.tr.setNodeAttribute(info.pos, name, value));
    },
  );

  const info = findEnclosingOfType(editorState, getPos(), typeNames);
  if (!info) return null;

  return createPortal(
    <div
      ref={(el) => {
        popoverRef.current = el;
        refs.setFloating(el);
      }}
      className="pb-block-settings"
      style={{ position: strategy, top: y ?? 0, left: x ?? 0 }}
    >
      <header className="pb-block-settings-header">
        <span className="pb-block-settings-title">{title}</span>
      </header>
      <div className="pb-block-settings-body">
        {children(info.node, setAttr, info.pos)}
      </div>
    </div>,
    document.body,
  );
}
