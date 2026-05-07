import { Check, Translate } from "@phosphor-icons/react";
import {
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixDropdownMenu from "@radix-ui/react-dropdown-menu";
import type { MarkSpec, MarkType } from "prosemirror-model";
import type { Command, EditorState } from "prosemirror-state";

import { useEditor } from "../Editor";
import { Dropdown } from "../menu";
import { Extension } from "../types";

export interface LanguageChoice {
  /** BCP-47 tag, e.g. "en", "fr", "ja", "zh-Hans". */
  code: string;
  label: string;
}

export const DEFAULT_LANGUAGES: LanguageChoice[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "zh-Hans", label: "中文 (简体)" },
  { code: "ko", label: "한국어" },
  { code: "ar", label: "العربية" },
  { code: "ru", label: "Русский" },
  { code: "he", label: "עברית" },
];

const languageMarkSpec: MarkSpec = {
  attrs: { lang: { default: null } },
  parseDOM: [
    {
      tag: "span[lang]",
      getAttrs(dom) {
        if (!(dom instanceof HTMLElement)) return false;
        const lang = dom.getAttribute("lang");
        return lang ? { lang } : false;
      },
    },
  ],
  toDOM(mark) {
    const lang = mark.attrs["lang"] as string | null;
    return ["span", lang ? { lang } : {}, 0];
  },
};

function setLanguageCommand(markType: MarkType, lang: string | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (empty) return false;
    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to, markType);
      if (lang) tr.addMark(from, to, markType.create({ lang }));
      dispatch(tr);
    }
    return true;
  };
}

function getActiveLanguage(
  state: EditorState | null,
  markType: MarkType,
): string | null {
  if (!state) return null;
  const { from, to, empty, $from } = state.selection;
  const marks = empty ? state.storedMarks ?? $from.marks() : null;
  if (marks) {
    const mark = marks.find((m) => m.type === markType);
    return (mark?.attrs["lang"] as string | null) ?? null;
  }
  let result: string | null | undefined;
  let conflict = false;
  state.doc.nodesBetween(from, to, (node) => {
    if (!node.isText) return true;
    const mark = node.marks.find((m) => m.type === markType);
    const value = (mark?.attrs["lang"] as string | null) ?? null;
    if (result === undefined) result = value;
    else if (result !== value) conflict = true;
    return undefined;
  });
  if (conflict) return null;
  return result ?? null;
}

interface LanguageToolbarItemProps {
  languages: LanguageChoice[];
}

function LanguageToolbarItem({ languages }: LanguageToolbarItemProps) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const markType = schema.marks["language"];

  const apply = useEditorEventCallback((view, lang: string | null) => {
    if (!view || !markType) return;
    setLanguageCommand(markType, lang)(view.state, view.dispatch);
    view.focus();
  });

  if (!markType) return null;

  const active = getActiveLanguage(editorState, markType);
  const activeChoice = languages.find((l) => l.code === active);

  return (
    <Dropdown
      label={<Translate size={18} weight="bold" />}
      title="Language"
      tooltip={
        active
          ? `Language: ${activeChoice?.label ?? active}`
          : "Language (for inline phrases)"
      }
      hideCaret
      triggerActive={!!active}
      triggerStyle={{ width: 30, padding: 0, gap: 0 }}
    >
      <RadixDropdownMenu.Item
        className="pp-dropdown-item pp-font-item"
        data-active={!active || undefined}
        onMouseDown={(e) => e.preventDefault()}
        onSelect={(e) => {
          e.preventDefault();
          apply(null);
        }}
      >
        <span className="pp-font-check" aria-hidden>
          {!active && <Check size={12} weight="bold" />}
        </span>
        <span className="pp-font-name">No language</span>
      </RadixDropdownMenu.Item>
      <RadixDropdownMenu.Separator className="pp-dropdown-separator" />
      {languages.map((lang) => (
        <RadixDropdownMenu.Item
          key={lang.code}
          className="pp-dropdown-item pp-font-item"
          data-active={active === lang.code || undefined}
          onMouseDown={(e) => e.preventDefault()}
          onSelect={(e) => {
            e.preventDefault();
            apply(lang.code);
          }}
        >
          <span className="pp-font-check" aria-hidden>
            {active === lang.code && <Check size={12} weight="bold" />}
          </span>
          <span className="pp-font-name">{lang.label}</span>
          <span className="pp-language-code">{lang.code}</span>
        </RadixDropdownMenu.Item>
      ))}
    </Dropdown>
  );
}

export interface LanguageOptions {
  languages?: LanguageChoice[];
}

export function createLanguage({
  languages = DEFAULT_LANGUAGES,
}: LanguageOptions = {}) {
  return Extension.create({
    name: "language",
    marks: { language: languageMarkSpec },
    toolbar: () => <LanguageToolbarItem languages={languages} />,
    meta: { label: "Language", group: "format", Icon: Translate },
  });
}

export const Language = createLanguage();
