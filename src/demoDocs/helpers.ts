import type { Node as PmNode, Schema } from "prosemirror-model";

export interface DocHelpers {
  /** Create a node by name. */
  node: (
    name: string,
    attrs?: Record<string, unknown> | null,
    content?: PmNode | PmNode[] | string | null,
  ) => PmNode;
  /** Create a text node, optionally with marks applied. */
  text: (
    value: string,
    marks?: ReturnType<Schema["mark"]>[],
  ) => PmNode;
  /** Look up a mark type by name. */
  mark: (
    name: string,
    attrs?: Record<string, unknown>,
  ) => ReturnType<Schema["mark"]>;
  /** A `paragraph` containing the supplied inline content. */
  para: (...content: (PmNode | string)[]) => PmNode;
  /** A `heading` of the given level with one text child. */
  h: (level: 1 | 2 | 3 | 4 | 5 | 6, value: string) => PmNode;
  /** A `list_item` whose content is one paragraph wrapping `value`. */
  li: (value: string) => PmNode;
  /** A `task_item` whose content is one paragraph wrapping `value`. */
  taskItem: (checked: boolean, value: string) => PmNode;
}

/**
 * Build a small set of node/mark helpers bound to a schema. Demo docs
 * reach for these to stay readable — the schema lookups would otherwise
 * dominate the doc's structure.
 */
export function makeDocHelpers(schema: Schema): DocHelpers {
  const text: DocHelpers["text"] = (value, marks) =>
    schema.text(value, marks && marks.length ? marks : undefined);

  const node: DocHelpers["node"] = (name, attrs, content) => {
    const type = schema.nodes[name];
    if (!type) throw new Error(`Unknown node type: ${name}`);
    if (typeof content === "string") {
      return type.create(attrs ?? null, schema.text(content));
    }
    return type.create(attrs ?? null, content as never);
  };

  const mark: DocHelpers["mark"] = (name, attrs = {}) => {
    const type = schema.marks[name];
    if (!type) throw new Error(`Unknown mark type: ${name}`);
    return type.create(attrs);
  };

  const wrapInlineString = (v: PmNode | string): PmNode =>
    typeof v === "string" ? text(v) : v;

  const para: DocHelpers["para"] = (...content) =>
    node("paragraph", null, content.map(wrapInlineString));

  const h: DocHelpers["h"] = (level, value) =>
    node("heading", { level }, schema.text(value));

  const li: DocHelpers["li"] = (value) =>
    node("list_item", null, node("paragraph", null, schema.text(value)));

  const taskItem: DocHelpers["taskItem"] = (checked, value) =>
    node(
      "task_item",
      { checked },
      node("paragraph", null, schema.text(value)),
    );

  return { node, text, mark, para, h, li, taskItem };
}
