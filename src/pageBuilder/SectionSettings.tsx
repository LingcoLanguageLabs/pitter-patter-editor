/**
 * Section settings popover — pagy's `panels/section-settings.tsx` rebuilt on PM
 * attrs. Opened from the gear in the section toolbar (`SectionChromeWidget`).
 *
 * Field-for-field port of pagy's panel (minus "Make global"):
 *   • Minimum height  — none / medium (66dvh) / large (100dvh)
 *   • Align content   — top / center / bottom; only when min height leaves
 *                        spare room (pagy gates it the same way)
 *   • Background      — solid / image / video mode switch
 *   • Image / Video   — file picker for the active media mode
 *   • Overlay         — none / light / medium / strong; only with media
 *   • Colors          — theme-variant "A" swatches (shared `ThemeVariantPicker`)
 *   • ID              — unique HTML id rendered onto the <section>
 *   • Spacing         — Vertical padding (symmetric `py-{unit}`), last like the
 *                        block popover's Spacing group
 *
 * The popover shell (anchoring, light-dismiss, portal) is shared with the
 * Header/Footer panels via `SettingsPopover`; this file is the section's
 * field list. Writes go straight to the section's attrs — no save button.
 */

"use client";

import {
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import {
  AlignBottom,
  AlignCenterVertical,
  AlignTop,
  ArrowsVertical,
} from "@phosphor-icons/react";

import {
  Field,
  ImagePicker,
  Segmented,
  ThemeVariantPicker,
} from "./blockSettings/forms";
import { ScrubField } from "./blockSettings/SpacingSection";
import { isHtmlIdTaken } from "./sectionUtils";
import { SettingsPopover } from "./SettingsPopover";
import {
  SECTION_PADDING_DEFAULT,
  SECTION_PADDING_MAX,
  SECTION_PADDING_SNAP,
  sectionPaddingPx,
} from "./spacing";

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
  return (
    <SettingsPopover
      anchor={anchor}
      getPos={getPos}
      onClose={onClose}
      typeNames={["section"]}
      title="Section"
    >
      {(node, setAttr, pos) => {
        const attrs = node.attrs;
        const padding = sectionPaddingPx(attrs);
        const minHeight = (attrs["minHeight"] as string) || "none";
        const contentAlign = (attrs["contentAlign"] as string) || "top";
        const background = (attrs["background"] as string) || "solid";
        const image = (attrs["image"] as string) || "";
        const video = (attrs["video"] as string) || "";
        const overlay = (attrs["overlay"] as string) || "";
        const theme = (attrs["theme"] as string | null) || "";
        const htmlId = (attrs["htmlId"] as string) || "";
        const hasMedia =
          (background === "image" && !!image) ||
          (background === "video" && !!video);

        // Soft ID validation: warn, never block — blocking exact matches would
        // fight typing toward a free name ("hero" → "hero-2"). The two things
        // that actually break an anchor: a duplicate id, and whitespace.
        const idWarning = /\s/.test(htmlId)
          ? "IDs can't contain spaces"
          : isHtmlIdTaken(editorState, pos, htmlId)
            ? "Already used by another section"
            : null;

        return (
          <>
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
              <ThemeVariantPicker
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
            {/* Spacing comes last, mirroring the block settings popover. */}
            <div className="pb-spacing">
              <div className="pb-spacing-head">
                <span className="pb-field-label">Spacing</span>
              </div>
              <ScrubField
                label="Vertical padding"
                icon={<ArrowsVertical size={14} />}
                value={padding}
                autoPx={SECTION_PADDING_DEFAULT}
                scale={SECTION_PADDING_SNAP}
                max={SECTION_PADDING_MAX}
                presets={SECTION_PADDING_SNAP}
                allowAuto={false}
                onChange={(v) => setAttr("padding", v ?? SECTION_PADDING_DEFAULT)}
              />
            </div>
          </>
        );
      }}
    </SettingsPopover>
  );
}
