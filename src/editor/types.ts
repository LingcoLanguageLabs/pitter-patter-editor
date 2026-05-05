import type { InputRule } from "prosemirror-inputrules";
import type { MarkSpec, NodeSpec, Schema } from "prosemirror-model";
import type { Command, EditorState, Plugin } from "prosemirror-state";
import type { ComponentType } from "react";

export type CommandFactory = (schema: Schema) => Command;
export type IsActiveFn = (state: EditorState, schema: Schema) => boolean;
export type PluginsFactory = (schema: Schema) => Plugin[];
export type InputRulesFactory = (schema: Schema) => InputRule[];

export interface ExtensionMeta {
  label?: string;
  shortcut?: string;
  group?: string;
  Icon?: ComponentType<{ size?: number; weight?: "regular" | "bold" }>;
}

export type NodePatch = (spec: NodeSpec) => NodeSpec;
export type MarkPatch = (spec: MarkSpec) => MarkSpec;

export interface Extension<TCommandName extends string = string> {
  name: string;
  marks?: Record<string, MarkSpec>;
  nodes?: Record<string, NodeSpec>;
  patchNodes?: Record<string, NodePatch>;
  patchMarks?: Record<string, MarkPatch>;
  commands?: Record<TCommandName, CommandFactory>;
  keymap?: Record<string, TCommandName>;
  isActive?: IsActiveFn;
  plugins?: PluginsFactory;
  inputRules?: InputRulesFactory;
  toolbar?: ComponentType;
  meta?: ExtensionMeta;
}

type ExtensionInput<C extends Record<string, CommandFactory>> = Omit<
  Extension,
  "commands" | "keymap"
> & {
  commands?: C;
  keymap?: Record<string, Extract<keyof C, string>>;
};

export const Extension = {
  create<C extends Record<string, CommandFactory>>(
    spec: ExtensionInput<C>,
  ): Extension<Extract<keyof C, string>> {
    return spec as Extension<Extract<keyof C, string>>;
  },
};

export interface EditorHandle<TCommandName extends string = string> {
  schema: Schema;
  commands: Map<TCommandName, Command>;
  isActiveByExtension: Map<string, IsActiveFn>;
  extensions: readonly Extension[];
}

type CommandNamesOf<X> = X extends Extension<infer N extends string> ? N : never;
export type ExtractCommandNames<E extends readonly Extension[]> = CommandNamesOf<E[number]>;
