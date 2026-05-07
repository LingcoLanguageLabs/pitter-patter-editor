import { ArrowSquareOut, PencilSimple, Trash } from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
} from "@handlewithcare/react-prosemirror";
import { TextSelection } from "prosemirror-state";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditor } from "../Editor";
import { Extension } from "../types";

interface HoveredLink {
  el: HTMLAnchorElement;
  rect: DOMRect;
  href: string;
}

/**
 * Floating popover that appears when the user hovers a link in the editor.
 * Shows the destination, an open-in-new-tab affordance, and remove/edit
 * controls. Skips link-card and footnote-reference anchors so they keep
 * their own UX.
 */
export function LinkHoverPopover() {
  const { schema } = useEditor();
  const linkMarkType = schema.marks["link"];
  const [hovered, setHovered] = useState<HoveredLink | null>(null);
  const hideTimer = useRef<number | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const cancelHide = () => {
    if (hideTimer.current != null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const scheduleHide = (delay = 250) => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => setHovered(null), delay);
  };

  useEditorEffect((view) => {
    const editorEl = view.dom;

    const handleOver = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      const a = target.closest("a[href]") as HTMLAnchorElement | null;
      if (!a || !editorEl.contains(a)) return;
      // Skip card-style and footnote anchors.
      if (
        a.classList.contains("pp-link-card") ||
        a.classList.contains("pp-footnote-ref") ||
        a.hasAttribute("data-anchor")
      ) {
        return;
      }
      cancelHide();
      const rect = a.getBoundingClientRect();
      setHovered((prev) => {
        if (prev && prev.el === a) return prev;
        return { el: a, rect, href: a.href };
      });
    };

    const handleOut = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      const a = target.closest("a[href]");
      if (!a) return;
      scheduleHide();
    };

    editorEl.addEventListener("mouseover", handleOver);
    editorEl.addEventListener("mouseout", handleOut);
    return () => {
      editorEl.removeEventListener("mouseover", handleOver);
      editorEl.removeEventListener("mouseout", handleOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reposition on scroll while popover is open.
  useEffect(() => {
    if (!hovered) return;
    const reposition = () => {
      const fresh = hovered.el.getBoundingClientRect();
      setHovered((prev) => (prev ? { ...prev, rect: fresh } : null));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [hovered]);

  const removeLink = useEditorEventCallback((view) => {
    if (!view || !hovered || !linkMarkType) return;
    const pos = view.posAtDOM(hovered.el, 0);
    if (pos == null || pos < 0) return;
    const $pos = view.state.doc.resolve(pos);
    let from = pos;
    let to = pos;
    // Find the contiguous range with this link mark.
    const mark = $pos
      .marks()
      .find((m) => m.type === linkMarkType && m.attrs["href"] === hovered.href);
    if (!mark) return;
    while (from > 0 && view.state.doc.resolve(from - 1).marks().some((m) => m.eq(mark))) {
      from--;
    }
    while (
      to < view.state.doc.content.size &&
      view.state.doc.resolve(to).marks().some((m) => m.eq(mark))
    ) {
      to++;
    }
    view.dispatch(view.state.tr.removeMark(from, to, linkMarkType));
    setHovered(null);
    view.focus();
  });

  const selectLinkRange = useEditorEventCallback((view) => {
    if (!view || !hovered) return;
    const pos = view.posAtDOM(hovered.el, 0);
    if (pos == null || pos < 0) return;
    if (!linkMarkType) return;
    const $pos = view.state.doc.resolve(pos);
    const mark = $pos
      .marks()
      .find((m) => m.type === linkMarkType && m.attrs["href"] === hovered.href);
    if (!mark) return;
    let from = pos;
    let to = pos;
    while (from > 0 && view.state.doc.resolve(from - 1).marks().some((m) => m.eq(mark))) {
      from--;
    }
    while (
      to < view.state.doc.content.size &&
      view.state.doc.resolve(to).marks().some((m) => m.eq(mark))
    ) {
      to++;
    }
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)),
    );
    view.focus();
  });

  if (!hovered) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="pp-link-hover"
      style={{
        position: "fixed",
        left: hovered.rect.left,
        top: hovered.rect.bottom + 6,
      }}
      onMouseEnter={cancelHide}
      onMouseLeave={() => scheduleHide()}
      role="tooltip"
    >
      <a
        href={hovered.href}
        target="_blank"
        rel="noopener noreferrer"
        className="pp-link-hover-href"
      >
        <span className="pp-link-hover-url">{hovered.href}</span>
        <ArrowSquareOut size={14} weight="bold" />
      </a>
      <div className="pp-link-hover-actions">
        <button
          type="button"
          className="pp-link-hover-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            selectLinkRange();
            scheduleHide(0);
          }}
          title="Edit link"
        >
          <PencilSimple size={14} weight="bold" />
        </button>
        <button
          type="button"
          className="pp-link-hover-btn pp-link-hover-btn-danger"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => removeLink()}
          title="Remove link"
        >
          <Trash size={14} weight="bold" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

export const HoverLink = Extension.create({
  name: "hover-link",
  meta: { label: "Link hover preview", group: "system" },
});
