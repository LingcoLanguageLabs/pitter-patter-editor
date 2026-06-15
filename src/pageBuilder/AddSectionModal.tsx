/**
 * "Add a section" modal — pagy.co's `add-section-modal.tsx`.
 *
 * A sidebar of categories (Global + 9 template groups) beside a scrollable
 * grid of live, scaled section previews. Picking one inserts that template
 * — a full `section` node — into the deck at the position the section
 * chrome stashed (`sectionInsertPos`), dispatched straight on the editor
 * `view` the store mirrors. "Add a blank section" inserts an empty section.
 *
 * It lives outside the ProseMirror React context (mounted in `Shell`), so
 * it talks to the editor through `pagesView` + `nodeFromJSON`, the same
 * bridge the Pages panel uses.
 */

"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { SectionTemplateCard } from "./SectionTemplateCard";
import { BLANK_SECTION, SECTION_CATEGORIES } from "./sections";
import { usePageBuilderStore } from "./store";

export function AddSectionModal() {
  const open = usePageBuilderStore((s) => s.sectionModalOpen);
  if (!open) return null;
  return <AddSectionModalBody />;
}

function AddSectionModalBody() {
  const insertPos = usePageBuilderStore((s) => s.sectionInsertPos);
  const close = usePageBuilderStore((s) => s.closeSectionModal);
  const view = usePageBuilderStore((s) => s.pagesView);
  const theme = usePageBuilderStore((s) => s.theme);

  // Default to "Header" (index 1) — "Global" (0) is empty until shared
  // sections exist, so landing there would show only the empty state.
  const [category, setCategory] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Escape closes; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  /** Insert a section template (full PM JSON) at the stashed position. */
  const insert = (template: unknown) => {
    if (!view || insertPos == null) {
      close();
      return;
    }
    const { state } = view;
    const pos = Math.min(insertPos, state.doc.content.size);
    const node = state.schema.nodeFromJSON(template);
    view.dispatch(state.tr.insert(pos, node).scrollIntoView());
    view.focus();
    close();
  };

  const active = SECTION_CATEGORIES[category];

  return createPortal(
    <div className="pb-section-modal-overlay" onMouseDown={close}>
      <div
        className="pb-section-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add a section"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="pb-section-modal-title">Add a section</h2>

        <div className="pb-section-modal-body">
          {/* Sidebar */}
          <div className="pb-section-modal-sidebar">
            <nav className="pb-section-nav">
              {SECTION_CATEGORIES.map((cat, i) => (
                <Fragment key={cat.name}>
                  <button
                    type="button"
                    className={`pb-section-nav-item${category === i ? " -active" : ""}`}
                    onClick={() => {
                      setCategory(i);
                      if (listRef.current) listRef.current.scrollTop = 0;
                    }}
                  >
                    {cat.name}
                  </button>
                  {i === 0 && <p className="pb-section-nav-label">Templates</p>}
                </Fragment>
              ))}
            </nav>
            <button type="button" className="pb-section-blank-btn" onClick={() => insert(BLANK_SECTION)}>
              Add a blank section
            </button>
          </div>

          {/* Preview grid */}
          <div className="pb-section-modal-content">
            <div className={`pb-section-modal-shadow${scrolled ? " -active" : ""}`} />
            <div
              className="pb-section-modal-list"
              ref={listRef}
              onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
            >
              {active.shared && active.templates.length === 0 ? (
                <p className="pb-section-modal-empty">Your shared sections will appear here.</p>
              ) : (
                active.templates.map((template, i) => (
                  <SectionTemplateCard
                    key={`${category}-${i}`}
                    template={template}
                    theme={theme}
                    onSelect={() => insert(template)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
