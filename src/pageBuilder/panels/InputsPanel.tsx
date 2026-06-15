/**
 * Design → Inputs. The form-field twin of the Buttons panel (pagy calls this
 * sub-panel "Forms"; we call it Inputs). Two token pickers that restyle every
 * field on the site:
 *   • Shape → `theme.inputs.shape` (radius-none | -small | -medium | -large)
 *   • Style → `theme.inputs.style` (solid | outline | soft | line)
 *
 * Each option is a live `.pp-field` preview inside a `.site`-classed frame, so
 * it inherits the working theme — exactly how the canvas will render fields.
 */

import { navigateTo, usePageBuilderStore } from "../store";

const SHAPES: { value: string; label: string }[] = [
  { value: "radius-large", label: "Pill" },
  { value: "radius-medium", label: "Rounded" },
  { value: "radius-small", label: "Soft" },
  { value: "radius-none", label: "Square" },
];

const STYLES: { value: string; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "outline", label: "Outline" },
  { value: "soft", label: "Subtle" },
  { value: "line", label: "Line" },
];

/** `input-shape-x input-style-y`, omitting either when its value is "". */
function tokenClass(shape: string, style: string): string {
  return [shape && `input-shape-${shape}`, style && `input-style-${style}`]
    .filter(Boolean)
    .join(" ");
}

export function InputsPanel() {
  const theme = usePageBuilderStore((s) => s.theme);
  const setTheme = usePageBuilderStore((s) => s.setTheme);

  const shape = theme.inputs?.shape ?? "";
  const style = theme.inputs?.style ?? "";
  const bg = theme.colors.background;

  const setShape = (value: string) =>
    setTheme((prev) => ({ ...prev, inputs: { ...prev.inputs, shape: value } }));
  const setStyle = (value: string) =>
    setTheme((prev) => ({ ...prev, inputs: { ...prev.inputs, style: value } }));

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
      <h1 className="pb-panel-title">Inputs</h1>

      <h2 className="pb-design-section-label">Shape</h2>
      <div className="pb-design-options">
        {SHAPES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="pb-design-option"
            data-active={opt.value === shape || undefined}
            aria-label={opt.label}
            aria-pressed={opt.value === shape}
            onClick={() => setShape(opt.value)}
          >
            <span
              className={`site pb-design-option-frame ${tokenClass(opt.value, style)}`}
              style={{ background: bg }}
            >
              <span className="pp-field">
                <span className="pp-field-text">Field</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      <h2 className="pb-design-section-label">Style</h2>
      <div className="pb-design-options">
        {STYLES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="pb-design-option"
            data-active={opt.value === style || undefined}
            aria-label={opt.label}
            aria-pressed={opt.value === style}
            onClick={() => setStyle(opt.value)}
          >
            <span
              className={`site pb-design-option-frame ${tokenClass(shape, opt.value)}`}
              style={{ background: bg }}
            >
              <span className="pp-field">
                <span className="pp-field-text">Field</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
