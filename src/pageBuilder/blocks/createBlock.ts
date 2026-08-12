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

import { getItemDefinition } from "../items/registry";
import { defaultHeadingSize } from "../schema";
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
  // Learning items build themselves (prompt + default options, stable ids).
  // `entry.attrs` carries any picker-preset attrs (e.g. an opinion poll's
  // scoringMode) for the item to stamp on construction.
  const itemDef = getItemDefinition(entry.type);
  if (itemDef) return itemDef.construct(schema, entry.attrs);

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
      // Picking a heading level picks its default size too (pagy's
      // `create-block.ts` does the same) — the Size control overrides.
      return need(schema, "heading").create(
        { level, size: defaultHeadingSize(level) },
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
      // The image requires an (empty) caption child — a real figcaption node so
      // the caption is rich + inline-editable. `entry.attrs` rides through so a
      // placeholder can carry e.g. `unsplashPending` (the Unsplash catalog block).
      return need(schema, "image").create(
        { src: "", alt: "", aspect: "16/9", ...(entry.attrs ?? {}) },
        need(schema, "image_caption").create(),
      );

    case "video":
      return need(schema, "video").create({
        src: "",
        poster: "",
      });

    case "audio":
      return need(schema, "audio").create({
        src: "",
      });

    case "embed":
      return need(schema, "embed").create({
        src: "",
        aspect: "16/9",
      });

    case "vector":
      return need(schema, "vector").create({
        markup: "",
        src: "",
        width: 100,
        align: "center",
      });

    case "divider":
      return need(schema, "divider").create({ variant: "solid" });

    case "progress":
      // Defaults to a score bar; the author rebinds the expression in settings.
      return need(schema, "progress").create({
        value: "score.percent",
        max: "100",
        display: "bar",
        color: "primary",
        label: "",
        showValue: true,
      });

    case "accordion": {
      const accordion = need(schema, "accordion");
      const item = need(schema, "accordion_item");
      const header = need(schema, "accordion_header");
      const panel = need(schema, "accordion_panel");
      const para = need(schema, "paragraph");
      const mkItem = (title: string, body: string, open: boolean) =>
        item.create({ open }, [
          header.create(null, schema.text(title)),
          panel.create(null, para.create(null, body ? schema.text(body) : undefined)),
        ]);
      return accordion.create(null, [
        mkItem("Section one", "The first panel's content.", true),
        mkItem("Section two", "The second panel's content.", false),
      ]);
    }

    case "tabs": {
      const tabs = need(schema, "tabs");
      const tab = need(schema, "tab");
      const label = need(schema, "tab_label");
      const panel = need(schema, "tab_panel");
      const para = need(schema, "paragraph");
      const mkTab = (name: string, body: string) =>
        tab.create(null, [
          label.create(null, schema.text(name)),
          panel.create(null, para.create(null, body ? schema.text(body) : undefined)),
        ]);
      return tabs.create({ active: 0 }, [
        mkTab("Tab one", "The first tab's content."),
        mkTab("Tab two", "The second tab's content."),
      ]);
    }

    case "table": {
      // A 3×3 with a header row, mirroring the base editor's insertTable.
      const tableType = need(schema, "table");
      const rowType = need(schema, "table_row");
      const cellType = need(schema, "table_cell");
      const headerType = need(schema, "table_header");
      const buildCell = (type: typeof cellType) => {
        const cell = type.createAndFill();
        if (!cell) throw new Error(`Could not create ${type.name}`);
        return cell;
      };
      const rows: PmNode[] = [];
      for (let r = 0; r < 3; r++) {
        const useHeader = r === 0;
        const cells: PmNode[] = [];
        for (let c = 0; c < 3; c++) {
          cells.push(buildCell(useHeader ? headerType : cellType));
        }
        rows.push(rowType.create(null, cells));
      }
      return tableType.create(null, rows);
    }

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
