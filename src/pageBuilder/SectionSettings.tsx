/**
 * Section settings popover — pagy's `panels/section-settings.tsx`
 * rebuilt on PM attrs. Opened from the gear in the section toolbar
 * (`SectionChromeWidget`), anchored to it with @floating-ui.
 *
 * Field-for-field port of pagy's panel (minus "Make global"):
 *   • Minimum height  — none / medium (66dvh) / large (100dvh)
 *   • Align content   — top / center / bottom; only when min height
 *                        leaves spare room (pagy gates it the same way)
 *   • Background      — solid / image / video mode switch
 *   • Image / Video   — file picker for the active media mode
 *   • Overlay         — none / light / medium / strong; only with media
 *   • Colors          — theme-variant "A" swatches (default / inverted /
 *                        primary / secondary / tertiary), mapping to the
 *                        `.theme.-X` variable scopes from `themeToCss`
 *   • ID              — unique HTML id rendered onto the <section>
 *
 * Writes go straight to the section's attrs via `setNodeAttribute`,
 * no save button — same live-update model as BlockSettings.
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
import {
  AlignBottom,
  AlignCenterVertical,
  AlignTop,
} from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Field, ImagePicker, Segmented } from "./blockSettings/forms";
import { findEnclosingSection, isHtmlIdTaken } from "./sectionUtils";
import { usePageBuilderStore } from "./store";

const MIN_HEIGHT_OPTIONS = [
  { value: "none", label: "None" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
] as const;

const CONTENT_ALIGN_OPTIONS = [
  { value: "top", label: <AlignTop size={16} />, title: "Top" },
  { value: "center", label: <AlignCenterVertical size={16} />, title: "Center" },
  { value: "bottom", label: <AlignBottom size={16} />, title: "Bottom" },
] as const;

const BACKGROUND_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
] as const;

const OVERLAY_OPTIONS = [
  { value: "", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "strong", label: "Strong" },
] as const;

/** Theme-variant swatches — pagy's "A" tiles. Each button carries
 *  `site theme -X`, so the globally injected `themeToCss` rules style
 *  it with that variant's actual background/foreground; the preview is
 *  always live against the current theme. Secondary/tertiary only show
 *  when the theme defines those colors (pagy gates them the same). */
function ThemeSwatches({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const theme = usePageBuilderStore((s) => s.theme);
  const variants: { key: string; className: string; label: string }[] = [
    { key: "", className: "-default", label: "Default" },
    { key: "inverted", className: "-inverted", label: "Inverted" },
    { key: "primary", className: "-primary", label: "Primary" },
    ...(theme.colors.secondary
      ? [{ key: "secondary", className: "-secondary", label: "Secondary" }]
      : []),
    ...(theme.colors.tertiary
      ? [{ key: "tertiary", className: "-tertiary", label: "Tertiary" }]
      : []),
  ];
  return (
    <div className="pb-theme-swatches" role="group" aria-label="Colors">
      {variants.map((v) => (
        <button
          key={v.key || "default"}
          type="button"
          className={`pb-theme-swatch site theme ${v.className}`}
          data-active={v.key === value || undefined}
          onClick={() => onChange(v.key)}
          aria-label={v.label}
          title={v.label}
        >
          A
        </button>
      ))}
    </div>
  );
}

export function SectionSettings({
  anchor,
  getPos,
  onClose,
}: {
  /** The toolbar gear button the popover is anchored to. */
  anchor: HTMLElement | null;
  /** The chrome widget's `getPos` — a position inside the section. */
  getPos: () => number;
  onClose: () => void;
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
      const info = findEnclosingSection(view.state, getPos());
      if (!info) return;
      view.dispatch(view.state.tr.setNodeAttribute(info.pos, name, value));
    },
  );

  const info = findEnclosingSection(editorState, getPos());
  if (!info) return null;
  const attrs = info.node.attrs;
  const minHeight = (attrs["minHeight"] as string) || "none";
  const contentAlign = (attrs["contentAlign"] as string) || "top";
  const background = (attrs["background"] as string) || "solid";
  const image = (attrs["image"] as string) || "";
  const video = (attrs["video"] as string) || "";
  const overlay = (attrs["overlay"] as string) || "";
  const theme = (attrs["theme"] as string | null) || "";
  const htmlId = (attrs["htmlId"] as string) || "";
  const hasMedia =
    (background === "image" && !!image) || (background === "video" && !!video);

  // Soft ID validation: warn, never block — blocking exact matches
  // would fight typing toward a free name ("hero" → "hero-2"). The
  // two things that actually break an anchor: a duplicate id, and
  // whitespace (invalid in an HTML id).
  const idWarning = /\s/.test(htmlId)
    ? "IDs can't contain spaces"
    : isHtmlIdTaken(editorState, info.pos, htmlId)
      ? "Already used by another section"
      : null;

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
        <span className="pb-block-settings-title">Section</span>
      </header>
      <div className="pb-block-settings-body">
        <Field label="Minimum height">
          <Segmented
            ariaLabel="Minimum height"
            value={minHeight}
            options={MIN_HEIGHT_OPTIONS}
            onChange={(v) => setAttr("minHeight", v)}
          />
        </Field>
        {minHeight !== "none" && (
          <Field label="Align content">
            <Segmented
              ariaLabel="Align content"
              value={contentAlign}
              options={CONTENT_ALIGN_OPTIONS}
              onChange={(v) => setAttr("contentAlign", v)}
            />
          </Field>
        )}
        <Field label="Background">
          <Segmented
            ariaLabel="Background"
            value={background}
            options={BACKGROUND_OPTIONS}
            onChange={(v) => setAttr("background", v)}
          />
        </Field>
        {background === "image" && (
          <Field label="Image">
            <ImagePicker src={image} onChange={(url) => setAttr("image", url)} />
          </Field>
        )}
        {background === "video" && (
          <Field label="Video">
            <ImagePicker
              kind="video"
              src={video}
              onChange={(url) => setAttr("video", url)}
            />
          </Field>
        )}
        {hasMedia && (
          <Field label="Overlay">
            <Segmented
              ariaLabel="Overlay"
              value={overlay}
              options={OVERLAY_OPTIONS}
              onChange={(v) => setAttr("overlay", v)}
            />
          </Field>
        )}
        <Field label="Colors">
          <ThemeSwatches
            value={theme}
            onChange={(v) => setAttr("theme", v || null)}
          />
        </Field>
        <Field label="ID">
          <input
            type="text"
            className="pb-text-input"
            value={htmlId}
            placeholder="section-name"
            autoComplete="off"
            spellCheck={false}
            data-invalid={!!idWarning || undefined}
            onChange={(e) => setAttr("htmlId", e.target.value)}
          />
          <span className="pb-field-hint" data-invalid={!!idWarning || undefined}>
            {idWarning ?? "Unique HTML ID"}
          </span>
        </Field>
      </div>
    </div>,
    document.body,
  );
}
