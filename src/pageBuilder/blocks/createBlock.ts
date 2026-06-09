/**
 * Block-factory: takes a catalog entry + the live ProseMirror schema and
 * returns a Fragment / Node ready to insert. Mirrors pagy's
 * `helpers/create-block.ts` in spirit — pagy builds Slate nodes, we
 * build PM nodes — but the contract is the same: name in, ready-to-go
 * tree out, including sensible default text/attrs so the inserted
 * block isn't empty.
 *
 * If the schema is missing a referenced type we throw early rather
 * than dispatch a broken transaction.
 */

import type { Node as PmNode, Schema } from "prosemirror-model";

import type { BlockCatalogEntry } from "./catalog";

function need(schema: Schema, type: string) {
  const t = schema.nodes[type];
  if (!t) throw new Error(`Schema is missing node type "${type}"`);
  return t;
}

export function createBlockNode(
  schema: Schema,
  entry: BlockCatalogEntry,
): PmNode {
  switch (entry.type) {
    case "paragraph":
      return need(schema, "paragraph").create(null, schema.text("New block"));

    case "heading": {
      const level = (entry.attrs?.["level"] as number | undefined) ?? 1;
      const fallback: Record<number, string> = {
        1: "Heading",
        2: "Heading 2",
        3: "Heading 3",
        4: "Heading 4",
      };
      return need(schema, "heading").create(
        { level },
        schema.text(fallback[level] ?? "Heading"),
      );
    }

    case "bullet_list":
    case "ordered_list": {
      const list = need(schema, entry.type);
      const item = need(schema, "list_item");
      const para = need(schema, "paragraph");
      return list.create(
        null,
        item.create(null, para.create(null, schema.text("List item"))),
      );
    }

    case "button":
      return need(schema, "button").create({
        label: "Button",
        variant: "primary",
        href: "#",
      });

    case "image":
      return need(schema, "image").create({
        src: "",
        alt: "",
        aspect: "16/9",
      });

    case "container": {
      const container = need(schema, "container");
      const para = need(schema, "paragraph");
      return container.create(
        null,
        para.create(null, schema.text("New block")),
      );
    }

    case "card": {
      const card = need(schema, "card");
      const para = need(schema, "paragraph");
      return card.create(null, para.create(null, schema.text("New block")));
    }

    case "row": {
      // Same pattern as the shuffle demo doc
      // (`packages/docs/src/components/demos/shuffle.tsx`): the row
      // itself sits edge-to-edge (shuffle's `.row` default) and the
      // children inside it get their own `shuffleStart/End` ranges
      // to place themselves side-by-side. Picking 1-5 / 7-12 keeps
      // a gap in the middle and stays within the section's columns.
      const row = need(schema, "row");
      const para = need(schema, "paragraph");
      return row.create({ shuffleStart: 1, shuffleEnd: 12 }, [
        para.create({ shuffleStart: 1, shuffleEnd: 5 }, schema.text("Left")),
        para.create({ shuffleStart: 7, shuffleEnd: 12 }, schema.text("Right")),
      ]);
    }

    case "section": {
      const section = need(schema, "section");
      const para = need(schema, "paragraph");
      return section.create(
        null,
        para.create(null, schema.text("New section")),
      );
    }

    default:
      throw new Error(`createBlockNode: no factory for type "${entry.type}"`);
  }
}
