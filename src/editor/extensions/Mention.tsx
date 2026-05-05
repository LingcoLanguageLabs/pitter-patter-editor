import { At } from "@phosphor-icons/react";
import type { MarkSpec, NodeSpec } from "prosemirror-model";
import { useMemo } from "react";

import { useEditor } from "../Editor";
import { createSuggestionPlugin, SuggestionPopover } from "../menu";
import { Extension } from "../types";

const { plugin, key } = createSuggestionPlugin({ char: "@" });

export interface MentionItem {
  id: string;
  label: string;
}

export interface MentionOptions {
  items?: (query: string) => MentionItem[] | Promise<MentionItem[]>;
}

const DEFAULT_USERS: MentionItem[] = [
  { id: "alex", label: "Alex Carter" },
  { id: "beth", label: "Beth Liu" },
  { id: "carlos", label: "Carlos Diaz" },
  { id: "dana", label: "Dana Park" },
  { id: "evan", label: "Evan Singh" },
  { id: "fatima", label: "Fatima Reyes" },
  { id: "gita", label: "Gita Patel" },
  { id: "hugo", label: "Hugo Müller" },
];

function defaultItems(query: string): MentionItem[] {
  if (!query) return DEFAULT_USERS.slice(0, 6);
  const q = query.toLowerCase();
  return DEFAULT_USERS.filter(
    (u) => u.label.toLowerCase().includes(q) || u.id.toLowerCase().includes(q),
  );
}

const mentionSpec: NodeSpec = {
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  attrs: {
    id: { default: "" },
    label: { default: "" },
  },
  parseDOM: [
    {
      tag: "span[data-mention]",
      getAttrs: (dom) => {
        const el = dom as HTMLElement;
        return {
          id: el.getAttribute("data-id") ?? "",
          label: el.getAttribute("data-label") ?? el.textContent?.replace(/^@/, "") ?? "",
        };
      },
    },
  ],
  toDOM: (node) => [
    "span",
    {
      "data-mention": "true",
      "data-id": String(node.attrs["id"] ?? ""),
      "data-label": String(node.attrs["label"] ?? ""),
      class: "pp-mention",
    },
    `@${node.attrs["label"]}`,
  ],
};

export function createMention(options: MentionOptions = {}) {
  return Extension.create({
    name: "mention",
    nodes: { mention: mentionSpec },
    plugins: () => [plugin],
    meta: { label: "Mention", group: "inline", Icon: At },
  });
}

export const Mention = Object.assign(createMention(), {
  configure: (options: MentionOptions) => createMention(options),
});

export interface MentionPopoverProps {
  items?: (query: string) => MentionItem[] | Promise<MentionItem[]>;
}

export function MentionPopover({ items: itemsFn = defaultItems }: MentionPopoverProps = {}) {
  const { schema } = useEditor();
  const mentionType = schema.nodes["mention"];

  const itemsCb = useMemo(() => itemsFn, [itemsFn]);

  if (!mentionType) return null;

  return (
    <SuggestionPopover<MentionItem>
      pluginKey={key}
      items={itemsCb}
      onSelect={({ view, range, item }) => {
        const node = mentionType.create({ id: item.id, label: item.label });
        const tr = view.state.tr.replaceWith(range.from, range.to, node);
        // append a trailing space for natural flow
        tr.insertText(" ", tr.mapping.map(range.to));
        view.dispatch(tr);
        view.focus();
      }}
      renderItem={({ item }) => (
        <div className="pp-mention-row">
          <span className="pp-mention-avatar">
            {item.label
              .split(/\s+/)
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase()}
          </span>
          <span className="pp-mention-text">
            <span className="pp-mention-name">{item.label}</span>
            <span className="pp-mention-id">@{item.id}</span>
          </span>
        </div>
      )}
      placement="bottom-start"
    />
  );
}
