/**
 * Footer settings popover — a footer is a leaner section, so its panel is just:
 *   • Colors   — theme-variant "A" swatches (shared `ThemeVariantPicker`)
 *   • Spacing  — Vertical padding (the same `ScrubField` the Section panel uses,
 *                driving the footer's symmetric `py-{unit}` padding)
 *
 * Shell (anchoring, light-dismiss, portal) lives in `SettingsPopover`.
 */

"use client";

import { ArrowsVertical } from "@phosphor-icons/react";

import { BarScopeField } from "./BarScopeField";
import { Field, ThemeVariantPicker } from "./blockSettings/forms";
import { ScrubField } from "./blockSettings/SpacingSection";
import { SettingsPopover } from "./SettingsPopover";
import {
  FOOTER_PADDING_DEFAULT,
  SECTION_PADDING_MAX,
  SECTION_PADDING_SNAP,
  sectionPaddingPx,
} from "./spacing";

export function FooterSettings({
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
      typeNames={["footer"]}
      title="Footer"
    >
      {(node, setAttr) => {
        const attrs = node.attrs;
        const theme = (attrs["theme"] as string) || "";
        const padding = sectionPaddingPx(attrs);
        return (
          <>
            <BarScopeField kind="footer" getPos={getPos} onClose={onClose} />
            <Field label="Colors">
              <ThemeVariantPicker
                value={theme}
                onChange={(v) => setAttr("theme", v)}
              />
            </Field>
            {/* Spacing last, mirroring the Section + block popovers. */}
            <div className="pb-spacing">
              <div className="pb-spacing-head">
                <span className="pb-field-label">Spacing</span>
              </div>
              <ScrubField
                label="Vertical padding"
                icon={<ArrowsVertical size={14} />}
                value={padding}
                autoPx={FOOTER_PADDING_DEFAULT}
                scale={SECTION_PADDING_SNAP}
                max={SECTION_PADDING_MAX}
                presets={SECTION_PADDING_SNAP}
                allowAuto={false}
                onChange={(v) => setAttr("padding", v ?? FOOTER_PADDING_DEFAULT)}
              />
            </div>
          </>
        );
      }}
    </SettingsPopover>
  );
}
