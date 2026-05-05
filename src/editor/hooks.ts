import { useEditorEventCallback, useEditorState } from "@handlewithcare/react-prosemirror";

import { useEditor } from "./Editor";

export function useIsActive(name: string): boolean {
  const { isActiveByExtension, schema } = useEditor();
  const editorState = useEditorState();
  const checker = isActiveByExtension.get(name);
  if (!checker || !editorState) return false;
  return checker(editorState, schema);
}

export function useCanRunCommand(name: string): boolean {
  const { commands } = useEditor();
  const editorState = useEditorState();
  const command = commands.get(name);
  if (!command || !editorState) return false;
  return command(editorState);
}

export function useRunCommand(name: string): () => void {
  const { commands } = useEditor();
  return useEditorEventCallback((view) => {
    if (!view) return;
    const command = commands.get(name);
    if (!command) return;
    command(view.state, view.dispatch, view);
    view.focus();
  });
}
