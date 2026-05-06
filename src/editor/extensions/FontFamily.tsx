import { Check, Plus } from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { MarkSpec, MarkType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";
import { useCallback, useEffect, useState } from "react";

import { useEditor } from "../Editor";
import { isMarkActive } from "../helpers";
import { Dropdown } from "../menu";
import { Extension } from "../types";

export interface FontFamilyOption {
  id: string;
  label: string;
  /** CSS font-family value applied to the mark. Empty string clears the mark. */
  value: string;
  /** Set to dynamically load via fonts.googleapis.com when first used. */
  googleFont?: { family: string; weights?: number[] };
}

const SYSTEM_FAMILY_GENERICS = new Set([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "ui-rounded",
  "sans-serif",
  "serif",
  "monospace",
  "cursive",
  "fantasy",
]);

function parseFirstFamily(stack: string | null | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || null;
}

function prettifyFamily(name: string | null): string {
  if (!name) return "Default";
  if (SYSTEM_FAMILY_GENERICS.has(name.toLowerCase())) return "System";
  return name;
}

export const DEFAULT_FONT_FAMILIES: FontFamilyOption[] = [
  {
    id: "system-sans",
    label: "Sans Serif",
    value:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  },
  {
    id: "system-serif",
    label: "Serif",
    value: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  },
  {
    id: "system-mono",
    label: "Monospace",
    value: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
  {
    id: "inter",
    label: "Inter",
    value: '"Inter", system-ui, sans-serif',
    googleFont: { family: "Inter", weights: [400, 500, 600, 700] },
  },
  {
    id: "roboto",
    label: "Roboto",
    value: '"Roboto", system-ui, sans-serif',
    googleFont: { family: "Roboto", weights: [400, 500, 700] },
  },
  {
    id: "open-sans",
    label: "Open Sans",
    value: '"Open Sans", sans-serif',
    googleFont: { family: "Open Sans", weights: [400, 600, 700] },
  },
  {
    id: "lato",
    label: "Lato",
    value: '"Lato", sans-serif',
    googleFont: { family: "Lato", weights: [400, 700] },
  },
  {
    id: "montserrat",
    label: "Montserrat",
    value: '"Montserrat", sans-serif',
    googleFont: { family: "Montserrat", weights: [400, 600, 700] },
  },
  {
    id: "lora",
    label: "Lora",
    value: '"Lora", serif',
    googleFont: { family: "Lora", weights: [400, 600, 700] },
  },
  {
    id: "merriweather",
    label: "Merriweather",
    value: '"Merriweather", serif',
    googleFont: { family: "Merriweather", weights: [400, 700] },
  },
  {
    id: "playfair",
    label: "Playfair Display",
    value: '"Playfair Display", serif',
    googleFont: { family: "Playfair Display", weights: [400, 600, 700] },
  },
  {
    id: "jetbrains-mono",
    label: "JetBrains Mono",
    value: '"JetBrains Mono", monospace',
    googleFont: { family: "JetBrains Mono", weights: [400, 700] },
  },
  {
    id: "fira-code",
    label: "Fira Code",
    value: '"Fira Code", monospace',
    googleFont: { family: "Fira Code", weights: [400, 700] },
  },
];

const fontFamilySpec: MarkSpec = {
  attrs: {
    fontFamily: { default: null },
  },
  parseDOM: [
    {
      tag: "span[data-font-family]",
      getAttrs: (dom) => ({
        fontFamily: (dom as HTMLElement).getAttribute("data-font-family"),
      }),
    },
    {
      style: "font-family",
      getAttrs: (value) => (value ? { fontFamily: value as string } : false),
    },
  ],
  toDOM(mark) {
    const fontFamily = mark.attrs["fontFamily"];
    const attrs: Record<string, string> = {};
    if (fontFamily) {
      attrs["data-font-family"] = fontFamily;
      attrs["style"] = `font-family: ${fontFamily}`;
    }
    return ["span", attrs, 0];
  },
};

function setFontFamily(markType: MarkType, fontFamily: string): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const stored = (state.storedMarks ?? state.selection.$from.marks()).filter(
          (m) => m.type !== markType,
        );
        tr.setStoredMarks([...stored, markType.create({ fontFamily })]);
      } else {
        tr.removeMark(from, to, markType);
        tr.addMark(from, to, markType.create({ fontFamily }));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function unsetFontFamily(markType: MarkType): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        const stored = (state.storedMarks ?? state.selection.$from.marks()).filter(
          (m) => m.type !== markType,
        );
        tr.setStoredMarks(stored);
      } else {
        tr.removeMark(from, to, markType);
      }
      dispatch(tr);
    }
    return true;
  };
}

function getActiveFontFamily(state: EditorState | null, markType: MarkType): string | null {
  if (!state) return null;
  const { from, to, empty, $from } = state.selection;
  const marks = empty ? state.storedMarks ?? $from.marks() : null;
  if (marks) {
    const mark = marks.find((m) => m.type === markType);
    return mark?.attrs["fontFamily"] ?? null;
  }
  let found: string | null = null;
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false;
    const mark = node.marks.find((m) => m.type === markType);
    if (mark) found = mark.attrs["fontFamily"] ?? null;
  });
  return found;
}

const RECENT_FONTS_KEY = "pp-recent-fonts";
const RECENT_LIMIT = 5;

const loadedGoogleFonts = new Set<string>();

function ensureGoogleFontLoaded(font: { family: string; weights?: number[] }) {
  if (typeof document === "undefined") return;
  if (loadedGoogleFonts.has(font.family)) return;
  if (document.querySelector(`link[data-pp-font="${CSS.escape(font.family)}"]`)) {
    loadedGoogleFonts.add(font.family);
    return;
  }
  const familyParam = font.family.replace(/ /g, "+");
  const weights = (font.weights ?? [400]).join(";");
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weights}&display=swap`;
  link.dataset["ppFont"] = font.family;
  document.head.appendChild(link);
  loadedGoogleFonts.add(font.family);
}

function readRecent(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_FONTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(ids.slice(0, RECENT_LIMIT)));
  } catch {
    /* quota or disabled */
  }
}

function useRecentFonts() {
  const [recent, setRecent] = useState<string[]>(() => readRecent());

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== RECENT_FONTS_KEY) return;
      setRecent(readRecent());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const push = useCallback((id: string) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_LIMIT);
      writeRecent(next);
      return next;
    });
  }, []);

  return [recent, push] as const;
}

interface FontPickerItemProps {
  option: FontFamilyOption;
  active: boolean;
  onSelect: (opt: FontFamilyOption) => void;
}

function FontPickerItem({ option, active, onSelect }: FontPickerItemProps) {
  return (
    <RadixDropdownMenu.Item
      className="pp-dropdown-item pp-font-item"
      data-active={active || undefined}
      onMouseDown={(e) => e.preventDefault()}
      onSelect={(e) => {
        e.preventDefault();
        onSelect(option);
      }}
    >
      <span className="pp-font-check" aria-hidden>
        {active && <Check size={12} weight="bold" />}
      </span>
      <span
        className="pp-font-name"
        style={{ fontFamily: option.value || "inherit" }}
      >
        {option.label}
      </span>
    </RadixDropdownMenu.Item>
  );
}

interface FontFamilyToolbarItemProps {
  options: FontFamilyOption[];
  defaultLabel: string | "auto";
}

function FontFamilyToolbarItem({ options, defaultLabel }: FontFamilyToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const markType = schema.marks["font_family"];
  const [recentIds, pushRecent] = useRecentFonts();
  const [resolvedDefault, setResolvedDefault] = useState<string | null>(null);

  // Auto-detect the default at the active block via getComputedStyle. Opt-in
  // because it depends on the host's CSS cascade — fine for an app, surprising
  // for a distributed plugin. Hook always runs (rules-of-hooks); the body
  // bails out unless the consumer opted in.
  useEditorEffect(
    (view) => {
      if (defaultLabel !== "auto" || !view) return;
      try {
        const { node } = view.domAtPos(view.state.selection.from);
        const target = node instanceof HTMLElement ? node : node.parentElement;
        if (!target) return;
        const family = parseFirstFamily(getComputedStyle(target).fontFamily);
        setResolvedDefault(family);
      } catch {
        /* DOM may not be ready yet */
      }
    },
    [defaultLabel, editorState?.selection.from],
  );

  // Preload Google Fonts so the dropdown previews each font in its own typeface.
  useEffect(() => {
    options.forEach((opt) => {
      if (opt.googleFont) ensureGoogleFontLoaded(opt.googleFont);
    });
  }, [options]);

  const defaultOption: FontFamilyOption = {
    id: "default",
    label: defaultLabel === "auto" ? prettifyFamily(resolvedDefault) : defaultLabel,
    value: "",
  };

  const apply = useEditorEventCallback((view, opt: FontFamilyOption) => {
    if (!view || !markType) return;
    const cmd =
      opt.id === "default"
        ? unsetFontFamily(markType)
        : setFontFamily(markType, opt.value);
    cmd(view.state, view.dispatch);
    view.focus();
    if (opt.googleFont) ensureGoogleFontLoaded(opt.googleFont);
    pushRecent(opt.id);
  });

  if (!markType) return null;

  const allOptions = [defaultOption, ...options];
  const sortedOptions = [
    defaultOption,
    ...options.slice().sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const activeValue = getActiveFontFamily(editorState, markType);
  const active =
    allOptions.find((o) => o.value === (activeValue ?? "")) ?? defaultOption;

  const recentOptions = recentIds
    .map((id) => allOptions.find((o) => o.id === id))
    .filter((o): o is FontFamilyOption => Boolean(o));

  return (
    <Dropdown
      label={
        <span
          className="pp-font-trigger"
          style={{ fontFamily: active.value || "inherit" }}
        >
          {active.label}
        </span>
      }
      title="Font"
      triggerStyle={{ minWidth: 140, maxWidth: 180 }}
    >
      {recentOptions.length > 0 && (
        <>
          <RadixDropdownMenu.Label className="pp-dropdown-section-label">
            Recent
          </RadixDropdownMenu.Label>
          {recentOptions.map((opt) => (
            <FontPickerItem
              key={`recent-${opt.id}`}
              option={opt}
              active={opt.id === active.id}
              onSelect={apply}
            />
          ))}
          <RadixDropdownMenu.Separator className="pp-dropdown-separator" />
        </>
      )}

      <RadixDropdownMenu.Item
        className="pp-dropdown-item pp-font-more"
        onMouseDown={(e) => e.preventDefault()}
        onSelect={(e) => {
          e.preventDefault();
          // Pass 2: open the "More fonts" modal.
        }}
      >
        <Plus size={14} weight="bold" />
        <span>More fonts…</span>
      </RadixDropdownMenu.Item>
      <RadixDropdownMenu.Separator className="pp-dropdown-separator" />

      {sortedOptions.map((opt) => (
        <FontPickerItem
          key={opt.id}
          option={opt}
          active={opt.id === active.id}
          onSelect={apply}
        />
      ))}
    </Dropdown>
  );
}

export interface FontFamilyOptions {
  options?: FontFamilyOption[];
  /**
   * Label for the "no font set" item.
   * - A string: shown verbatim. (Default: "Default".)
   * - "auto": resolved at runtime from `getComputedStyle` of the active block,
   *   matching what the user actually sees rendered. Opt-in because it
   *   depends on the host's CSS cascade and may shift between blocks if the
   *   host's stylesheets target editor children with different fonts.
   */
  defaultLabel?: string | "auto";
}

export function createFontFamily({
  options = DEFAULT_FONT_FAMILIES,
  defaultLabel = "Default",
}: FontFamilyOptions = {}) {
  return Extension.create({
    name: "font-family",
    marks: { font_family: fontFamilySpec },
    isActive: (state, schema) => {
      const markType = schema.marks["font_family"];
      return markType ? isMarkActive(state, markType) : false;
    },
    toolbar: () => (
      <FontFamilyToolbarItem options={options} defaultLabel={defaultLabel} />
    ),
    meta: { label: "Font", group: "format" },
  });
}

export const FontFamily = createFontFamily();
