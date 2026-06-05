/**
 * Page-builder editor. Hosts a ProseMirror instance with the
 * page-builder schema and renders the canvas overlays alongside the
 * doc.
 *
 * Everything substantial lives in its own module:
 *
 *   • `schema.ts`           — builds the schema (page-builder nodes
 *                              + shuffle + section containment).
 *   • `nodeViews/`          — section / button / image NodeViews.
 *   • `sectionChromePlugin` — adds the "+ Add block / + Add section"
 *                              affordances per section via a widget
 *                              decoration.
 *   • `ShuffleDragSync`     — mirrors shuffle's drag state into
 *                              `usePageBuilderStore`.
 *
 * This file's job is to wire them together inside one ProseMirror.
 */

import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
} from "@handlewithcare/react-prosemirror";
import {
  DragHandles,
  ResizeHandles,
  ShuffleSkeleton,
  shuffle,
} from "@pitter-patter/shuffle";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Schema } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";
import { EditorState, type Command } from "prosemirror-state";
import { useMemo } from "react";

import "@pitter-patter/shuffle/style/shuffle.css";

import { Bold, History, Italic, Strike, Underline } from "../editor/extensions";
import type { Extension } from "../editor/types";

import { attrClassesPlugin } from "./attrClassesPlugin";
import { BlockSettings } from "./blockSettings/BlockSettings";
import { nodeViewComponents } from "./nodeViews";
import { buildPageBuilderSchema, type InitialDocBuilder } from "./schema";
import { sectionChromePlugin } from "./sectionChromePlugin";
import { ShuffleDragSync } from "./ShuffleDragSync";

const markExtensions: readonly Extension[] = [Bold, Italic, Underline, Strike];
const systemExtensions: readonly Extension[] = [History];

/** Folds extension marks into the basic schema's marks map. */
function collectMarks(): typeof basic.spec.marks {
  let marks = basic.spec.marks;
  for (const ext of markExtensions) {
    if (!ext.marks) continue;
    for (const [name, spec] of Object.entries(ext.marks)) {
      if (marks.get(name)) continue;
      marks = marks.addToEnd(name, spec);
    }
  }
  return marks;
}

/** Resolves the keymap shortcuts declared by extensions against the
 *  finished schema. */
function collectKeymap(schema: Schema): Record<string, Command> {
  const map: Record<string, Command> = {};
  for (const ext of [...systemExtensions, ...markExtensions]) {
    if (!ext.commands || !ext.keymap) continue;
    for (const [stroke, commandName] of Object.entries(ext.keymap)) {
      const factory = ext.commands[commandName];
      if (factory) map[stroke] = factory(schema);
    }
  }
  return map;
}

/** Collects the plugins each extension contributes. */
function collectExtensionPlugins(schema: Schema) {
  return [...systemExtensions, ...markExtensions].flatMap(
    (ext) => ext.plugins?.(schema) ?? [],
  );
}

export interface PageBuilderEditorProps {
  initialDoc: InitialDocBuilder;
  overlays?: React.ReactNode;
}

export function PageBuilderEditor({
  initialDoc,
  overlays,
}: PageBuilderEditorProps) {
  const editorState = useMemo(() => {
    const base = new Schema({
      nodes: basic.spec.nodes,
      marks: collectMarks(),
    });
    const schema = buildPageBuilderSchema(base);
    return EditorState.create({
      doc: initialDoc(schema),
      plugins: [
        reactKeys(),
        shuffle(),
        sectionChromePlugin(),
        attrClassesPlugin(),
        ...collectExtensionPlugins(schema),
        keymap(collectKeymap(schema)),
        keymap(baseKeymap),
      ],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ProseMirror
      defaultState={editorState}
      nodeViewComponents={nodeViewComponents}
    >
      <ShuffleDragSync />
      <ShuffleSkeleton>
        <ProseMirrorDoc />
        <ResizeHandles />
        <DragHandles />
      </ShuffleSkeleton>
      <BlockSettings />
      {overlays}
    </ProseMirror>
  );
}
