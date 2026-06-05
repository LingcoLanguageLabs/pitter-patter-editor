/**
 * Per-block-type settings forms.
 *
 * Adding a new form is two things:
 *   1. Implement a `BlockForm` component for the node type.
 *   2. Add it to `BLOCK_FORMS` + a label to `BLOCK_TITLES`. The
 *      orchestrator in `BlockSettings.tsx` does the rest.
 *
 * Every form receives the `ActiveBlock` plus a `setAttr(name, value)`
 * helper that dispatches a `setNodeAttribute` transaction. That keeps
 * the forms purely presentational — no PM imports here.
 *
 * Forms map onto pagy's `panels/block-settings.tsx` per-type branches.
 * Stack is intentionally omitted (redundant with container) — every
 * other supported node type has a form.
 */

import type { Node as PmNode } from "prosemirror-model";
import type { ComponentType } from "react";

import { usePageBuilderStore } from "../store";
import type { Align, AlignContent, Size } from "../schema";

export interface ActiveBlock {
  /** Doc position of the node. */
  pos: number;
  /** The node itself, so forms can read current attrs. */
  node: PmNode;
  /** Schema name of the node. */
  typeName: keyof typeof BLOCK_FORMS;
}

export interface BlockFormProps {
  active: ActiveBlock;
  setAttr: (name: string, value: unknown) => void;
}

type BlockForm = ComponentType<BlockFormProps>;

// ────────────────────────────────────────────────────────────────
// Reusable controls
// ────────────────────────────────────────────────────────────────

/** Segmented-button group — used for align, size, variant, width,
 *  align-content, and anywhere else with a small set of options. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="pb-segmented" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="pb-segmented-option"
          data-active={opt.value === value || undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="pb-field-block">
      <span className="pb-field-label">{label}</span>
      {children}
    </label>
  );
}

const ALIGN_OPTIONS: readonly { value: Align; label: string }[] = [
  { value: "left", label: "⟵" },
  { value: "center", label: "≡" },
  { value: "right", label: "⟶" },
];

const SIZE_OPTIONS: readonly { value: Size; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "s", label: "S" },
  { value: "m", label: "M" },
  { value: "l", label: "L" },
  { value: "xl", label: "XL" },
];

const ALIGN_CONTENT_OPTIONS: readonly {
  value: AlignContent;
  label: string;
}[] = [
  { value: "top", label: "⤒" },
  { value: "middle", label: "—" },
  { value: "bottom", label: "⤓" },
  { value: "space-between", label: "⇔" },
];

// ────────────────────────────────────────────────────────────────
// Text-block forms (paragraph, heading)
// ────────────────────────────────────────────────────────────────

const ParagraphForm: BlockForm = ({ active, setAttr }) => {
  const align = (active.node.attrs["align"] as Align) ?? "left";
  const size = (active.node.attrs["size"] as Size) ?? "m";
  return (
    <>
      <Field label="Align">
        <Segmented
          ariaLabel="Align"
          value={align}
          options={ALIGN_OPTIONS}
          onChange={(v) => setAttr("align", v)}
        />
      </Field>
      <Field label="Size">
        <Segmented
          ariaLabel="Size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("size", v)}
        />
      </Field>
    </>
  );
};

const HeadingForm: BlockForm = ({ active, setAttr }) => {
  const level = (active.node.attrs["level"] as number) ?? 1;
  const align = (active.node.attrs["align"] as Align) ?? "left";
  const size = (active.node.attrs["size"] as Size) ?? "m";
  return (
    <>
      <Field label="Level">
        <Segmented
          ariaLabel="Level"
          value={String(level)}
          options={[1, 2, 3, 4].map((n) => ({
            value: String(n),
            label: `H${n}`,
          }))}
          onChange={(v) => setAttr("level", Number(v))}
        />
      </Field>
      <Field label="Align">
        <Segmented
          ariaLabel="Align"
          value={align}
          options={ALIGN_OPTIONS}
          onChange={(v) => setAttr("align", v)}
        />
      </Field>
      <Field label="Size">
        <Segmented
          ariaLabel="Size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("size", v)}
        />
      </Field>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Button form
// ────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonColor = "neutral" | "primary" | "secondary" | "tertiary";

/** Color swatches sourced from the active theme. Mirrors pagy's
 *  contrast-aware color picker (we ship the picker; full contrast
 *  warnings can come later if needed). */
function ButtonColorPicker({
  value,
  onChange,
}: {
  value: ButtonColor;
  onChange: (next: ButtonColor) => void;
}) {
  const theme = usePageBuilderStore((s) => s.theme);
  const slots: { key: ButtonColor; color: string | undefined }[] = [
    { key: "neutral", color: theme.colors.neutral },
    { key: "primary", color: theme.colors.primary },
    { key: "secondary", color: theme.colors.secondary },
    { key: "tertiary", color: theme.colors.tertiary },
  ];
  return (
    <div className="pb-color-swatches" role="group" aria-label="Color">
      {slots.map((slot) => (
        <button
          key={slot.key}
          type="button"
          className="pb-color-swatch"
          data-active={slot.key === value || undefined}
          style={{ background: slot.color ?? "#ccc" }}
          onClick={() => onChange(slot.key)}
          aria-label={slot.key}
        />
      ))}
    </div>
  );
}

const ButtonForm: BlockForm = ({ active, setAttr }) => {
  const label = (active.node.attrs["label"] as string) ?? "";
  const variant =
    (active.node.attrs["variant"] as ButtonVariant) ?? "primary";
  const color = (active.node.attrs["color"] as ButtonColor) ?? "primary";
  const size = (active.node.attrs["size"] as Size) ?? "s";
  const width = (active.node.attrs["width"] as "fit" | "fill") ?? "fit";
  const align = (active.node.attrs["align"] as Align) ?? "left";
  const href = (active.node.attrs["href"] as string) ?? "#";
  const openInNewTab = !!active.node.attrs["openInNewTab"];
  return (
    <>
      <Field label="Label">
        <input
          type="text"
          className="pb-text-input"
          value={label}
          onChange={(e) => setAttr("label", e.target.value)}
        />
      </Field>
      <Field label="Type">
        <Segmented
          ariaLabel="Type"
          value={variant}
          options={[
            { value: "primary", label: "Filled" },
            { value: "secondary", label: "Outline" },
            { value: "ghost", label: "Ghost" },
          ]}
          onChange={(v) => setAttr("variant", v)}
        />
      </Field>
      <Field label="Color">
        <ButtonColorPicker
          value={color}
          onChange={(v) => setAttr("color", v)}
        />
      </Field>
      <Field label="Size">
        <Segmented
          ariaLabel="Size"
          value={size}
          options={SIZE_OPTIONS}
          onChange={(v) => setAttr("size", v)}
        />
      </Field>
      <Field label="Width">
        <Segmented
          ariaLabel="Width"
          value={width}
          options={[
            { value: "fit", label: "Fit" },
            { value: "fill", label: "Fill" },
          ]}
          onChange={(v) => setAttr("width", v)}
        />
      </Field>
      <Field label="Align">
        <Segmented
          ariaLabel="Align"
          value={align}
          options={ALIGN_OPTIONS}
          onChange={(v) => setAttr("align", v)}
        />
      </Field>
      <Field label="Link">
        <input
          type="text"
          className="pb-text-input"
          value={href}
          onChange={(e) => setAttr("href", e.target.value)}
        />
      </Field>
      <Field label="Open in new tab">
        <Segmented
          ariaLabel="Open in new tab"
          value={openInNewTab ? "yes" : "no"}
          options={[
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ]}
          onChange={(v) => setAttr("openInNewTab", v === "yes")}
        />
      </Field>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Image form
// ────────────────────────────────────────────────────────────────

const ImageForm: BlockForm = ({ active, setAttr }) => {
  const src = (active.node.attrs["src"] as string) ?? "";
  const alt = (active.node.attrs["alt"] as string) ?? "";
  const aspect = (active.node.attrs["aspect"] as string) ?? "16/9";
  return (
    <>
      <Field label="Source">
        <input
          type="text"
          className="pb-text-input"
          value={src}
          onChange={(e) => setAttr("src", e.target.value)}
        />
      </Field>
      <Field label="Alt text">
        <input
          type="text"
          className="pb-text-input"
          value={alt}
          onChange={(e) => setAttr("alt", e.target.value)}
        />
      </Field>
      <Field label="Aspect">
        <Segmented
          ariaLabel="Aspect"
          value={aspect}
          options={[
            { value: "16/9", label: "16:9" },
            { value: "4/3", label: "4:3" },
            { value: "1/1", label: "1:1" },
          ]}
          onChange={(v) => setAttr("aspect", v)}
        />
      </Field>
    </>
  );
};

// ────────────────────────────────────────────────────────────────
// Layout-block forms (row, container)
// ────────────────────────────────────────────────────────────────

const LayoutAlignForm: BlockForm = ({ active, setAttr }) => {
  const alignContent =
    (active.node.attrs["alignContent"] as AlignContent) ?? "middle";
  return (
    <Field label="Align content">
      <Segmented
        ariaLabel="Align content"
        value={alignContent}
        options={ALIGN_CONTENT_OPTIONS}
        onChange={(v) => setAttr("alignContent", v)}
      />
    </Field>
  );
};

// ────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────

export const BLOCK_FORMS = {
  paragraph: ParagraphForm,
  heading: HeadingForm,
  button: ButtonForm,
  image: ImageForm,
  row: LayoutAlignForm,
  container: LayoutAlignForm,
} as const;

export const BLOCK_TITLES: Record<keyof typeof BLOCK_FORMS, string> = {
  paragraph: "Paragraph",
  heading: "Heading",
  button: "Button",
  image: "Image",
  row: "Row",
  container: "Container",
};
