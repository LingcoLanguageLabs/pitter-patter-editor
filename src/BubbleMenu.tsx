import {
  ArrowSquareOut,
  Code,
  ArrowBendDownLeft,
  LinkSimple,
  Sparkle,
  TextB,
  TextItalic,
  TextStrikethrough,
  TextUnderline,
  Trash,
} from "@phosphor-icons/react";
import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";
import { NodeSelection, type EditorState } from "prosemirror-state";
import { useEffect, useRef, useState } from "react";

import { useEditor } from "./editor";
import { isMarkActive } from "./editor";
import { MenuItem, ToggleMarkItem } from "./editor";
import {
  FloatingMenu,
  Toolbar as ToolbarPrimitive,
  ToolbarGroup,
  ToolbarSeparator,
  TooltipProvider,
} from "./editor/menu";
import { aiOpenDock, aiPluginKey } from "./editor/extensions/Ai";
import { applyLink, getActiveHref, removeLink } from "./editor/extensions/Link";

function MarkButton({
  markName,
  Icon,
  tooltip,
  shortcut,
}: {
  markName: string;
  Icon: typeof TextB;
  tooltip: string;
  shortcut?: string;
}) {
  const { schema } = useEditor();
  const markType = schema.marks[markName];
  if (!markType) return null;
  return (
    <ToggleMarkItem markType={markType} tooltip={tooltip} shortcut={shortcut}>
      <Icon size={16} weight="bold" />
    </ToggleMarkItem>
  );
}

function LinkTriggerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const linkType = schema.marks["link"];
  if (!linkType) return null;
  const hasLink = isMarkActive(editorState, linkType);
  return (
    <MenuItem
      active={open || hasLink}
      onClick={onClick}
      tooltip="Link"
      shortcut="⌘K"
    >
      <LinkSimple size={16} weight="bold" />
    </MenuItem>
  );
}

function LinkPanel({ onClose }: { onClose: () => void }) {
  const { schema } = useEditor();
  const editorState = useEditorState();
  const linkType = schema.marks["link"];
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = linkType ? getActiveHref(editorState, linkType) ?? "" : "";
  const [value, setValue] = useState(initial);
  const active = linkType ? isMarkActive(editorState, linkType) : false;

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const apply = useEditorEventCallback((view, href: string) => {
    if (!view || !linkType) return;
    if (!href) return;
    applyLink(linkType, href)(view.state, view.dispatch);
    view.focus();
  });

  const remove = useEditorEventCallback((view) => {
    if (!view || !linkType) return;
    removeLink(linkType)(view.state, view.dispatch);
    view.focus();
  });

  if (!linkType) return null;

  const trimmed = value.trim();
  const canOpen = !!trimmed;

  return (
    <form
      className="pp-link-panel"
      onSubmit={(e) => {
        e.preventDefault();
        apply(trimmed);
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <input
        ref={inputRef}
        type="url"
        className="pp-link-panel-input"
        placeholder="Paste a link..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <button
        type="submit"
        className="pp-link-panel-btn"
        title="Apply"
        disabled={!trimmed}
      >
        <ArrowBendDownLeft size={14} weight="bold" />
      </button>
      <span className="pp-link-panel-divider" aria-hidden />
      <a
        className="pp-link-panel-btn"
        href={canOpen ? trimmed : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!canOpen}
        title="Open in new window"
        onClick={(e) => {
          if (!canOpen) e.preventDefault();
        }}
      >
        <ArrowSquareOut size={14} weight="bold" />
      </a>
      <button
        type="button"
        className="pp-link-panel-btn pp-link-panel-remove"
        onClick={() => {
          remove();
          onClose();
        }}
        title="Remove link"
        disabled={!active}
      >
        <Trash size={14} weight="bold" />
      </button>
    </form>
  );
}

function insideTable(state: EditorState): boolean {
  for (let d = state.selection.$from.depth; d > 0; d--) {
    const t = state.selection.$from.node(d).type.name;
    if (t === "table_cell" || t === "table_header") return true;
  }
  return false;
}

const shouldShow = (state: EditorState) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  if (state.selection instanceof NodeSelection) return false;
  if (insideTable(state)) return false;
  if (state.doc.textBetween(from, to).trim().length === 0) return false;
  return true;
};

function AiBubbleButton() {
  const editorState = useEditorState();
  const aiInstalled =
    editorState ? aiPluginKey.getState(editorState) != null : false;
  const open = useEditorEventCallback((view) => {
    if (!view) return;
    aiOpenDock()(view.state, view.dispatch);
  });
  if (!aiInstalled) return null;
  return (
    <MenuItem onClick={() => open()} tooltip="Ask AI" shortcut="⌘J">
      <Sparkle size={16} weight="bold" />
    </MenuItem>
  );
}

export function BubbleMenu() {
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={300}>
      <FloatingMenu shouldShow={shouldShow}>
        <div className="pp-bubble-stack">
          <ToolbarPrimitive variant="floating">
            <ToolbarGroup>
              <AiBubbleButton />
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <MarkButton markName="strong" Icon={TextB} tooltip="Bold" shortcut="⌘B" />
              <MarkButton markName="em" Icon={TextItalic} tooltip="Italic" shortcut="⌘I" />
              <MarkButton
                markName="underline"
                Icon={TextUnderline}
                tooltip="Underline"
                shortcut="⌘U"
              />
              <MarkButton
                markName="strike"
                Icon={TextStrikethrough}
                tooltip="Strike"
                shortcut="⌘⇧S"
              />
            </ToolbarGroup>
            <ToolbarSeparator />
            <ToolbarGroup>
              <MarkButton markName="code" Icon={Code} tooltip="Code" shortcut="⌘E" />
              <LinkTriggerButton
                open={linkOpen}
                onClick={() => setLinkOpen((v) => !v)}
              />
            </ToolbarGroup>
          </ToolbarPrimitive>
          {linkOpen && <LinkPanel onClose={() => setLinkOpen(false)} />}
        </div>
      </FloatingMenu>
    </TooltipProvider>
  );
}
