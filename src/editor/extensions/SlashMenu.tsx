import {
  CheckSquare,
  CodeBlock as CodeBlockIcon,
  Folder,
  GridNine,
  Info,
  Lightbulb,
  ListBullets,
  ListNumbers,
  Minus,
  Note,
  Quotes,
  TextHOne,
  TextHThree,
  TextHTwo,
  TextT,
  Warning,
  WarningOctagon,
} from "@phosphor-icons/react";
import { setBlockType, wrapIn } from "prosemirror-commands";
import type { Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { useMemo, type ComponentType } from "react";

import { useEditor } from "../Editor";
import { toggleList } from "../helpers";
import { createSuggestionPlugin, SuggestionPopover } from "../menu";
import { Extension } from "../types";

const { plugin, key } = createSuggestionPlugin({ char: "/" });

interface SlashItem {
  id: string;
  label: string;
  description?: string;
  Icon: ComponentType<{ size: number; weight: "bold" }>;
  keywords?: string[];
  command: (view: EditorView) => void;
}

function runCommand(view: EditorView, factory: (schema: Schema) => Command) {
  const cmd = factory(view.state.schema);
  cmd(view.state, view.dispatch, view);
  view.focus();
}

function buildItems(schema: Schema): SlashItem[] {
  const items: SlashItem[] = [];
  const heading = schema.nodes["heading"];
  const paragraph = schema.nodes["paragraph"];
  const blockquote = schema.nodes["blockquote"];
  const codeBlock = schema.nodes["code_block"];
  const bulletList = schema.nodes["bullet_list"];
  const orderedList = schema.nodes["ordered_list"];
  const listItem = schema.nodes["list_item"];
  const taskList = schema.nodes["task_list"];
  const taskItem = schema.nodes["task_item"];
  const hr = schema.nodes["horizontal_rule"];
  const details = schema.nodes["details"];
  const detailsSummary = schema.nodes["details_summary"];
  const detailsContent = schema.nodes["details_content"];
  const tableNode = schema.nodes["table"];

  if (paragraph) {
    items.push({
      id: "paragraph",
      label: "Paragraph",
      description: "Plain text",
      Icon: TextT,
      keywords: ["text", "p"],
      command: (view) => runCommand(view, () => setBlockType(paragraph)),
    });
  }
  if (heading) {
    for (const level of [1, 2, 3] as const) {
      const Icon = level === 1 ? TextHOne : level === 2 ? TextHTwo : TextHThree;
      items.push({
        id: `h${level}`,
        label: `Heading ${level}`,
        description: `Section heading level ${level}`,
        Icon,
        keywords: [`h${level}`, "heading", "title"],
        command: (view) => runCommand(view, () => setBlockType(heading, { level })),
      });
    }
  }
  if (bulletList && listItem) {
    items.push({
      id: "bullet-list",
      label: "Bulleted list",
      description: "Unordered list",
      Icon: ListBullets,
      keywords: ["bullet", "ul", "unordered"],
      command: (view) => runCommand(view, () => toggleList(bulletList, listItem)),
    });
  }
  if (orderedList && listItem) {
    items.push({
      id: "ordered-list",
      label: "Numbered list",
      description: "Ordered list",
      Icon: ListNumbers,
      keywords: ["numbered", "ol", "ordered"],
      command: (view) => runCommand(view, () => toggleList(orderedList, listItem)),
    });
  }
  if (taskList && taskItem) {
    items.push({
      id: "task-list",
      label: "Task list",
      description: "Checkable items",
      Icon: CheckSquare,
      keywords: ["todo", "checkbox", "task"],
      command: (view) =>
        runCommand(view, () => toggleList(taskList, taskItem)),
    });
  }
  if (blockquote) {
    items.push({
      id: "quote",
      label: "Quote",
      description: "Blockquote",
      Icon: Quotes,
      keywords: ["blockquote", "citation"],
      command: (view) => runCommand(view, () => wrapIn(blockquote)),
    });
  }
  const footnoteReference = schema.nodes["footnote_reference"];
  if (footnoteReference) {
    items.push({
      id: "footnote",
      label: "Footnote",
      description: "Add a numbered reference",
      Icon: ListNumbers,
      keywords: ["footnote", "ref", "reference", "citation"],
      command: (view) => {
        const node = footnoteReference.create({
          "data-id":
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `fn-${Math.random().toString(36).slice(2, 10)}`,
          referenceNumber: "",
        });
        view.dispatch(view.state.tr.replaceSelectionWith(node, false).scrollIntoView());
        view.focus();
      },
    });
  }
  const callout = schema.nodes["callout"];
  if (callout) {
    const variants = [
      { id: "note", label: "Note callout", Icon: Note, keywords: ["callout", "note", "admonition"] },
      { id: "info", label: "Info callout", Icon: Info, keywords: ["callout", "info", "admonition"] },
      { id: "tip", label: "Tip callout", Icon: Lightbulb, keywords: ["callout", "tip", "hint"] },
      { id: "warning", label: "Warning callout", Icon: Warning, keywords: ["callout", "warning", "caution"] },
      { id: "danger", label: "Danger callout", Icon: WarningOctagon, keywords: ["callout", "danger", "alert", "error"] },
    ] as const;
    for (const v of variants) {
      items.push({
        id: `callout-${v.id}`,
        label: v.label,
        description: "Highlighted block",
        Icon: v.Icon,
        keywords: [...v.keywords],
        command: (view) =>
          runCommand(view, () => wrapIn(callout, { variant: v.id })),
      });
    }
  }
  if (codeBlock) {
    items.push({
      id: "code-block",
      label: "Code block",
      description: "Multi-line code",
      Icon: CodeBlockIcon,
      keywords: ["code", "pre"],
      command: (view) => runCommand(view, () => setBlockType(codeBlock)),
    });
  }
  if (details && detailsSummary && detailsContent && paragraph) {
    items.push({
      id: "details",
      label: "Toggle / details",
      description: "Collapsible block",
      Icon: Folder,
      keywords: ["toggle", "collapse", "details", "expand"],
      command: (view) => {
        const node = details.create({ open: true }, [
          detailsSummary.create(),
          detailsContent.create(null, paragraph.create()),
        ]);
        view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
        view.focus();
      },
    });
  }
  if (hr) {
    items.push({
      id: "hr",
      label: "Divider",
      description: "Horizontal rule",
      Icon: Minus,
      keywords: ["divider", "hr", "line", "rule"],
      command: (view) => {
        view.dispatch(
          view.state.tr.replaceSelectionWith(hr.create()).scrollIntoView(),
        );
        view.focus();
      },
    });
  }
  if (tableNode) {
    items.push({
      id: "table",
      label: "Table",
      description: "Insert 3×3 table",
      Icon: GridNine,
      keywords: ["table", "grid"],
      command: (view) => {
        const tableRow = view.state.schema.nodes["table_row"];
        const tableCell = view.state.schema.nodes["table_cell"];
        const tableHeader = view.state.schema.nodes["table_header"];
        const para = view.state.schema.nodes["paragraph"];
        if (!tableRow || !tableCell || !tableHeader || !para) return;
        const headerRow = tableRow.create(
          null,
          Array.from({ length: 3 }, () =>
            tableHeader.create(null, para.create()),
          ),
        );
        const bodyRow = tableRow.create(
          null,
          Array.from({ length: 3 }, () =>
            tableCell.create(null, para.create()),
          ),
        );
        const node = tableNode.create(null, [headerRow, bodyRow, bodyRow]);
        view.dispatch(view.state.tr.replaceSelectionWith(node).scrollIntoView());
        view.focus();
      },
    });
  }

  return items;
}

function filterItems(all: SlashItem[], query: string): SlashItem[] {
  if (!query) return all;
  const q = query.toLowerCase();
  return all.filter((item) => {
    if (item.label.toLowerCase().includes(q)) return true;
    if (item.id.includes(q)) return true;
    return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
  });
}

export const SlashMenu = Extension.create({
  name: "slash-menu",
  plugins: () => [plugin],
});

export function SlashMenuPopover() {
  const { schema } = useEditor();
  const allItems = useMemo(() => buildItems(schema), [schema]);

  return (
    <SuggestionPopover<SlashItem>
      pluginKey={key}
      items={(query) => filterItems(allItems, query)}
      onSelect={({ view, range, item }) => {
        view.dispatch(view.state.tr.delete(range.from, range.to));
        item.command(view);
      }}
      renderItem={({ item }) => (
        <div className="pp-slash-row">
          <span className="pp-slash-icon">
            <item.Icon size={16} weight="bold" />
          </span>
          <span className="pp-slash-text">
            <span className="pp-slash-label">{item.label}</span>
            {item.description && (
              <span className="pp-slash-desc">{item.description}</span>
            )}
          </span>
        </div>
      )}
      placement="bottom-start"
    />
  );
}
