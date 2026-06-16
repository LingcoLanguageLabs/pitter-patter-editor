/**
 * Header settings popover — a field-for-field port of pagy's header panel:
 *   • Position    — Normal / Fixed (sticks to the top while scrolling)
 *   • Colors      — theme-variant "A" swatches (shared `ThemeVariantPicker`)
 *   • Background  — Solid / Blur / Transparent
 *   • Spacing     — Vertical padding (the `ScrubField` the Section/Footer panels
 *                   use, driving the bar's symmetric `py-{unit}` padding = its height)
 *
 * The popover shell (anchoring, light-dismiss, portal) lives in
 * `SettingsPopover`; this file is just the header's field list. Writes go
 * straight to the header node's attrs via the shell's `setAttr`.
 */

"use client";

import { ArrowsVertical } from "@phosphor-icons/react";

import { BarScopeField } from "./BarScopeField";
import { Field, Segmented, ThemeVariantPicker } from "./blockSettings/forms";
import { ScrubField } from "./blockSettings/SpacingSection";
import type { HeaderBackground } from "./schema";
import { SettingsPopover } from "./SettingsPopover";
import {
  HEADER_PADDING_DEFAULT,
  SECTION_PADDING_MAX,
  SECTION_PADDING_SNAP,
  sectionPaddingPx,
} from "./spacing";

const POSITION_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "fixed", label: "Fixed" },
] as const;

const BACKGROUND_OPTIONS: readonly { value: HeaderBackground; label: string }[] = [
  { value: "", label: "Solid" },
  { value: "blur", label: "Blur" },
  { value: "transparent", label: "Transparent" },
];

export function HeaderSettings({
  anchor,
  getPos,
  onClose,
}: {
  anchor: HTMLElement | null;
  getPos: () => number;
  onClose: () => void;
}) {
  return (
    <SettingsPopover
      anchor={anchor}
      getPos={getPos}
      onClose={onClose}
      typeNames={["header"]}
      title="Header"
    >
      {(node, setAttr) => {
        const attrs = node.attrs;
        const fixed = !!attrs["fixed"];
        const theme = (attrs["theme"] as string) || "";
        const background = (attrs["background"] as HeaderBackground) || "";
        const padding = sectionPaddingPx(attrs);
        return (
          <>
            <BarScopeField kind="header" getPos={getPos} onClose={onClose} />
            <Field label="Position">
              <Segmented
                ariaLabel="Position"
                value={fixed ? "fixed" : "normal"}
                options={POSITION_OPTIONS}
                onChange={(v) => setAttr("fixed", v === "fixed")}
              />
            </Field>
            <Field label="Colors">
              <ThemeVariantPicker
                value={theme}
                onChange={(v) => setAttr("theme", v)}
              />
            </Field>
            <Field label="Background">
              <Segmented
                ariaLabel="Background"
                value={background}
                options={BACKGROUND_OPTIONS}
                onChange={(v) => setAttr("background", v)}
              />
            </Field>
            {/* Spacing last, mirroring the Section + Footer popovers. */}
            <div className="pb-spacing">
              <div className="pb-spacing-head">
                <span className="pb-field-label">Spacing</span>
              </div>
              <ScrubField
                label="Vertical padding"
                icon={<ArrowsVertical size={14} />}
                value={padding}
                autoPx={HEADER_PADDING_DEFAULT}
                scale={SECTION_PADDING_SNAP}
                max={SECTION_PADDING_MAX}
                presets={SECTION_PADDING_SNAP}
                allowAuto={false}
                onChange={(v) => setAttr("padding", v ?? HEADER_PADDING_DEFAULT)}
              />
            </div>
          </>
        );
      }}
    </SettingsPopover>
  );
}
