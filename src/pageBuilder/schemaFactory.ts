/**
 * Builds the page-builder ProseMirror schema standalone — the same one
 * `<Editor>` constructs inline — so other entry points (the runtime
 * renderer's story, a future publish/parse step via `Node.fromJSON`) can
 * get a schema without booting the editor.
 *
 * Mirrors `Editor.tsx`: fold the mark extensions into the basic schema's
 * marks, then run the page-builder pipeline (`buildPageBuilderSchema`).
 */

import { Schema } from "prosemirror-model";
import { schema as basic } from "prosemirror-schema-basic";

import { Bold, Italic, Strike, Underline } from "../editor/extensions";
import type { Extension } from "../editor/types";

import { buildPageBuilderSchema } from "./schema";

const markExtensions: readonly Extension[] = [Bold, Italic, Underline, Strike];

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

export function createPageBuilderSchema(): Schema {
  const base = new Schema({
    nodes: basic.spec.nodes,
    marks: collectMarks(),
  });
  return buildPageBuilderSchema(base);
}
