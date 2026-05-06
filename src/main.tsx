import { ProseMirrorDoc } from "@handlewithcare/react-prosemirror";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { createRoot } from "react-dom/client";

import { buildInitialDoc, editor } from "./configuredEditor";
import { EmojiPopover, MentionPopover, SlashMenuPopover } from "./editor/extensions";
import { BubbleMenu } from "./BubbleMenu";
import { ImageBubbleMenu } from "./ImageBubbleMenu";
import { TableBubbleMenu } from "./TableBubbleMenu";
import { Toolbar } from "./Toolbar";

import "prosemirror-view/style/prosemirror.css";
import "./styles.css";

export type { EditorCommand } from "./configuredEditor";

function App() {
  return (
    <div className="editor-shell">
      <h2 className="editor-title">Pitter Patter Editor</h2>
      <div className="editor-surface">
        <editor.Editor baseSchema={basicSchema} initialDoc={buildInitialDoc}>
          <Toolbar />
          <ProseMirrorDoc />
          <BubbleMenu />
          <TableBubbleMenu />
          <ImageBubbleMenu />
          <SlashMenuPopover />
          <MentionPopover />
          <EmojiPopover />
        </editor.Editor>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(<App />);
