/**
 * Design → Buttons. Mirrors pagy `src/editor/panels/design/buttons.tsx`.
 *
 * Two token pickers that restyle every button on the site at once:
 *   • Shape  → `theme.buttons.radius` ("" pill / none / small / medium)
 *   • Style  → `theme.buttons.style`  ("" flat / thick / soft / shadow /
 *              sharp / brutal)
 *
 * Each option is a live preview: a `.site`-classed frame (so it inherits the
 * working theme's colors via the globally-injected `themeToCss` rules) plus
 * the `button-radius-*` / `button-style-*` class it represents, combined with
 * the *other* token's current value — exactly how the canvas renders it.
 */

import { navigateTo, usePageBuilderStore } from "../store";

const SHAPES: { value: string; label: string }[] = [
  { value: "", label: "Pill" },
  { value: "medium", label: "Rounded" },
  { value: "small", label: "Soft" },
  { value: "none", label: "Square" },
];

const STYLES: { value: string; label: string }[] = [
  { value: "", label: "Flat" },
  { value: "thick", label: "Thick" },
  { value: "soft", label: "Soft" },
  { value: "shadow", label: "Shadow" },
  { value: "sharp", label: "Sharp" },
  { value: "brutal", label: "Brutal" },
];

/** `button-radius-x button-style-y`, omitting either when its value is "". */
function tokenClass(radius: string, style: string): string {
  return [radius && `button-radius-${radius}`, style && `button-style-${style}`]
    .filter(Boolean)
    .join(" ");
}

export function ButtonsPanel() {
  const theme = usePageBuilderStore((s) => s.theme);
  const setTheme = usePageBuilderStore((s) => s.setTheme);

  const radius = theme.buttons?.radius ?? "";
  const style = theme.buttons?.style ?? "";
  const bg = theme.colors.background;

  const setRadius = (value: string) =>
    setTheme((prev) => ({ ...prev, buttons: { ...prev.buttons, radius: value } }));
  const setStyle = (value: string) =>
    setTheme((prev) => ({ ...prev, buttons: { ...prev.buttons, style: value } }));

  return (
    <>
      <button
        type="button"
        className="pb-panel-back"
        onClick={() => navigateTo("design")}
        aria-label="Back"
      >
        ←
      </button>
      <h1 className="pb-panel-title">Buttons</h1>

      <h2 className="pb-design-section-label">Shape</h2>
      <div className="pb-design-options">
        {SHAPES.map((opt) => (
          <button
            key={opt.value || "pill"}
            type="button"
            className="pb-design-option"
            data-active={opt.value === radius || undefined}
            aria-label={opt.label}
            aria-pressed={opt.value === radius}
            onClick={() => setRadius(opt.value)}
          >
            <span
              className={`site pb-design-option-frame ${tokenClass(opt.value, style)}`}
              style={{ background: bg }}
            >
              <span className="pp-button pp-button--primary pp-color-primary pp-size-s">
                Button
              </span>
            </span>
          </button>
        ))}
      </div>

      <h2 className="pb-design-section-label">Style</h2>
      <div className="pb-design-options">
        {STYLES.map((opt) => (
          <button
            key={opt.value || "flat"}
            type="button"
            className="pb-design-option"
            data-active={opt.value === style || undefined}
            aria-label={opt.label}
            aria-pressed={opt.value === style}
            onClick={() => setStyle(opt.value)}
          >
            <span
              className={`site pb-design-option-frame ${tokenClass(radius, opt.value)}`}
              style={{ background: bg }}
            >
              <span className="pp-button pp-button--primary pp-color-primary pp-size-s">
                Button
              </span>
              <span className="pp-button pp-button--secondary pp-color-primary pp-size-s">
                Button
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
