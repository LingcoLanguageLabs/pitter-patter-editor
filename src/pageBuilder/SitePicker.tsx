/**
 * Site picker — the menu sheet's header control.
 *
 * Shows the active sample site (name + plan badge + subdomain) and, on click,
 * drops down a card listing every site in the store with a checkmark on the
 * active one, plus a "+ New site" row. Picking a site switches the whole
 * editor to it (`setActiveSite` re-themes; the `<Shell>` re-mounts the editor
 * keyed on `activeSiteId`); "+ New site" mints a fresh blank site.
 *
 * The dropdown is anchored to the button by @floating-ui and portaled to
 * `document.body` (so the panel's overflow can't clip it), sized to match the
 * button's width. A capture-phase pointerdown + Escape light-dismiss closes it
 * — the same pattern as `SettingsPopover`.
 */

"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import {
  ArrowCounterClockwise,
  CaretUpDown,
  Check,
  Plus,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePageBuilderStore } from "./store";

export function SitePicker() {
  const sites = usePageBuilderStore((s) => s.sites);
  const activeSiteId = usePageBuilderStore((s) => s.activeSiteId);
  const setActiveSite = usePageBuilderStore((s) => s.setActiveSite);
  const addNewSite = usePageBuilderStore((s) => s.addNewSite);
  const resetSites = usePageBuilderStore((s) => s.resetSites);

  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const active = sites.find((s) => s.id === activeSiteId) ?? sites[0];

  const { x, y, strategy, refs } = useFloating({
    placement: "bottom-start",
    middleware: [
      offset(6),
      flip(),
      shift({ padding: 12 }),
      // Match the dropdown's width to the picker button so it lines up under it.
      size({
        apply({ rects, elements }) {
          elements.floating.style.width = `${rects.reference.width}px`;
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  // Light-dismiss: pointerdown outside the menu + button, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return; // button toggles itself
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!active) return null;

  return (
    <>
      <button
        type="button"
        ref={(el) => {
          buttonRef.current = el;
          refs.setReference(el);
        }}
        className="pb-site-picker"
        data-open={open || undefined}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="pb-site-picker-text">
          <div className="pb-site-picker-name">
            {active.name}{" "}
            <span className="pb-site-picker-plan">{active.plan}</span>
          </div>
          <div className="pb-site-picker-subdomain">{active.subdomain}</div>
        </div>
        <CaretUpDown size={16} weight="regular" />
      </button>

      {open &&
        createPortal(
          <div
            ref={(el) => {
              menuRef.current = el;
              refs.setFloating(el);
            }}
            className="pb-site-menu"
            style={{ position: strategy, top: y ?? 0, left: x ?? 0 }}
            role="listbox"
          >
            {sites.map((site) => {
              const isActive = site.id === active.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className="pb-site-menu-item"
                  onClick={() => {
                    setActiveSite(site.id);
                    setOpen(false);
                  }}
                >
                  <div className="pb-site-picker-text">
                    <div className="pb-site-picker-name">
                      {site.name}{" "}
                      <span className="pb-site-picker-plan">{site.plan}</span>
                    </div>
                    <div className="pb-site-picker-subdomain">
                      {site.subdomain}
                    </div>
                  </div>
                  {isActive && (
                    <Check
                      size={18}
                      weight="bold"
                      className="pb-site-menu-check"
                    />
                  )}
                </button>
              );
            })}

            <button
              type="button"
              className="pb-site-menu-new"
              onClick={() => {
                addNewSite();
                setOpen(false);
              }}
            >
              <Plus size={16} weight="bold" />
              New site
            </button>

            {/* Debug: local persistence is on, so this wipes the saved catalog
                (edits, theme overrides, "+ New site" entries) back to the seed. */}
            <div className="pb-site-menu-divider" />
            <button
              type="button"
              className="pb-site-menu-reset"
              onClick={() => {
                resetSites();
                setOpen(false);
              }}
            >
              <ArrowCounterClockwise size={15} weight="bold" />
              Reset sites
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}
