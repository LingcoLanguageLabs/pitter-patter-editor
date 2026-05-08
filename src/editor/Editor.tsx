import { ProseMirror, reactKeys } from "@handlewithcare/react-prosemirror";
import { baseKeymap, chainCommands } from "prosemirror-commands";
import { inputRules } from "prosemirror-inputrules";
import type { InputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { Schema, type Node } from "prosemirror-model";
import { EditorState, type Command, type Plugin, type Transaction } from "prosemirror-state";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCanRunCommand, useIsActive, useRunCommand } from "./hooks";
import type {
  EditorHandle,
  Extension,
  ExtractCommandNames,
  IsActiveFn,
} from "./types";

interface EditorProps {
  baseSchema: Schema;
  extensions: readonly Extension[];
  initialDoc?: (schema: Schema) => Node;
  children: ReactNode;
}

const EditorContext = createContext<EditorHandle | null>(null);

export function useEditor(): EditorHandle {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditor must be used inside <Editor>");
  return ctx;
}

function buildSchema(base: Schema, extensions: readonly Extension[]): Schema {
  let marks = base.spec.marks;
  let nodes = base.spec.nodes;
  for (const ext of extensions) {
    if (ext.marks) {
      for (const [name, spec] of Object.entries(ext.marks)) {
        marks = marks.addToEnd(name, spec);
      }
    }
    if (ext.nodes) {
      for (const [name, spec] of Object.entries(ext.nodes)) {
        nodes = nodes.addToEnd(name, spec);
      }
    }
  }
  for (const ext of extensions) {
    if (ext.patchNodes) {
      for (const [name, patch] of Object.entries(ext.patchNodes)) {
        const existing = nodes.get(name);
        if (!existing) {
          throw new Error(
            `Extension "${ext.name}" tried to patch node "${name}" but it does not exist`,
          );
        }
        nodes = nodes.update(name, patch(existing));
      }
    }
    if (ext.patchMarks) {
      for (const [name, patch] of Object.entries(ext.patchMarks)) {
        const existing = marks.get(name);
        if (!existing) {
          throw new Error(
            `Extension "${ext.name}" tried to patch mark "${name}" but it does not exist`,
          );
        }
        marks = marks.update(name, patch(existing));
      }
    }
  }
  return new Schema({ nodes, marks });
}

function buildCommands(schema: Schema, extensions: readonly Extension[]): Map<string, Command> {
  const commands = new Map<string, Command>();
  for (const ext of extensions) {
    if (!ext.commands) continue;
    for (const [name, factory] of Object.entries(ext.commands)) {
      commands.set(name, factory(schema));
    }
  }
  return commands;
}

function buildIsActive(extensions: readonly Extension[]): Map<string, IsActiveFn> {
  const map = new Map<string, IsActiveFn>();
  for (const ext of extensions) {
    if (ext.isActive) map.set(ext.name, ext.isActive);
  }
  return map;
}

function buildKeymapBindings(
  commands: Map<string, Command>,
  extensions: readonly Extension[],
): Record<string, Command> {
  const collected: Record<string, Command[]> = {};
  for (const ext of extensions) {
    if (!ext.keymap) continue;
    for (const [stroke, commandName] of Object.entries(ext.keymap)) {
      const cmd = commands.get(commandName);
      if (!cmd) continue;
      collected[stroke] = collected[stroke] ?? [];
      collected[stroke].push(cmd);
    }
  }
  const bindings: Record<string, Command> = {};
  for (const [stroke, cmds] of Object.entries(collected)) {
    bindings[stroke] = cmds.length === 1 ? cmds[0]! : chainCommands(...cmds);
  }
  return bindings;
}

function buildPlugins(
  schema: Schema,
  extensions: readonly Extension[],
  commands: Map<string, Command>,
): Plugin[] {
  const plugins: Plugin[] = [];
  for (const ext of extensions) {
    if (ext.plugins) plugins.push(...ext.plugins(schema));
  }
  const allInputRules: InputRule[] = [];
  for (const ext of extensions) {
    if (ext.inputRules) allInputRules.push(...ext.inputRules(schema));
  }
  if (allInputRules.length > 0) {
    plugins.push(inputRules({ rules: allInputRules }));
  }
  // Note: history()'s ProseMirror plugin and the Mod-z / Mod-y /
  // Shift-Mod-z keymap come from the Undo and Redo Extensions — make
  // sure both are in the extension list when you want history.
  plugins.push(keymap(buildKeymapBindings(commands, extensions)));
  plugins.push(keymap(baseKeymap));
  plugins.push(reactKeys());
  return plugins;
}

export function Editor({ baseSchema, extensions, initialDoc, children }: EditorProps) {
  const schema = useMemo(() => buildSchema(baseSchema, extensions), [baseSchema, extensions]);
  const commands = useMemo(() => buildCommands(schema, extensions), [schema, extensions]);
  const isActiveByExtension = useMemo(() => buildIsActive(extensions), [extensions]);
  const plugins = useMemo(
    () => buildPlugins(schema, extensions, commands),
    [schema, extensions, commands],
  );

  const [state, setState] = useState(() =>
    EditorState.create({
      doc: initialDoc?.(schema),
      schema,
      plugins,
    }),
  );

  const dispatchTransaction = useCallback((tr: Transaction) => {
    setState((prev) => prev.apply(tr));
  }, []);

  const handle = useMemo<EditorHandle>(
    () => ({ schema, commands, isActiveByExtension, extensions }),
    [schema, commands, isActiveByExtension, extensions],
  );

  return (
    <EditorContext.Provider value={handle}>
      <ProseMirror state={state} dispatchTransaction={dispatchTransaction}>
        {children}
      </ProseMirror>
    </EditorContext.Provider>
  );
}

interface BoundEditorProps {
  baseSchema: Schema;
  initialDoc?: (schema: Schema) => Node;
  children: ReactNode;
}

export interface TypedEditor<TCommandName extends string> {
  extensions: readonly Extension[];
  Editor: (props: BoundEditorProps) => ReturnType<typeof Editor>;
  useEditor: () => EditorHandle<TCommandName>;
  useRunCommand: (name: TCommandName) => () => void;
  useCanRunCommand: (name: TCommandName) => boolean;
  useIsActive: (extensionName: string) => boolean;
}

export function createEditor<const E extends readonly Extension[]>(
  extensions: E,
): TypedEditor<ExtractCommandNames<E>> {
  type Names = ExtractCommandNames<E>;
  function BoundEditor({ baseSchema, initialDoc, children }: BoundEditorProps) {
    return (
      <Editor baseSchema={baseSchema} extensions={extensions} initialDoc={initialDoc}>
        {children}
      </Editor>
    );
  }
  return {
    extensions,
    Editor: BoundEditor,
    useEditor: useEditor as () => EditorHandle<Names>,
    useRunCommand: useRunCommand as (name: Names) => () => void,
    useCanRunCommand: useCanRunCommand as (name: Names) => boolean,
    useIsActive,
  };
}
