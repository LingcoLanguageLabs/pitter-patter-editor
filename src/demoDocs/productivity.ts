import type { Schema } from "prosemirror-model";

import { makeDocHelpers } from "./helpers";

/**
 * A focused doc for template-style authoring — leans on Variables,
 * Date, Anchor, Footnote, and Math, with a calmer narrative than the
 * full feature tour.
 */
export function buildProductivityDoc(schema: Schema) {
  const { node, text, mark, para, h, li } = makeDocHelpers(schema);

  const bold = mark("strong");
  const italic = mark("em");
  const code = mark("code");
  const link = (href: string) => mark("link", { href });

  return node("doc", null, [
    h(1, "Customer onboarding — {{customer_name}}"),
    para(
      text("Sent "),
      schema.nodes["date"]!.create({ value: "2026-05-07" }),
      text(" by "),
      schema.nodes["mention"]!.create({ id: "alex", label: "Alex" }),
      text(". This is a template — fill in "),
      schema.nodes["variable"]!.create({ name: "customer_name", defaultValue: "Friend" }),
      text(" and "),
      schema.nodes["variable"]!.create({ name: "company", defaultValue: "Acme Inc." }),
      text(" before sending."),
    ),

    node(
      "callout",
      { variant: "tip" },
      para(
        text("Variables and dates are first-class. Click any chip to edit in place; defaults render when no value is bound."),
      ),
    ),

    h(2, "Welcome"),
    para(
      text("Hi "),
      schema.nodes["variable"]!.create({ name: "customer_name", defaultValue: "Friend" }),
      text(","),
    ),
    para(
      text("Welcome to "),
      schema.nodes["variable"]!.create({ name: "company", defaultValue: "Acme Inc." }),
      text(". This guide walks through the first week. We'll cover three topics:"),
    ),
    node("ordered_list", null, [
      li("How accounts and roles work"),
      li("Connecting your first integration"),
      li("Where to get help"),
    ]),

    h(2, "Accounts and roles "),
    schema.nodes["anchor"]!.create({ id: "accounts" }),
    para(
      text("Every "),
      schema.nodes["variable"]!.create({ name: "company", defaultValue: "Acme Inc." }),
      text(" workspace has three roles: "),
      text("owner", [bold]),
      text(", "),
      text("editor", [bold]),
      text(", and "),
      text("viewer", [bold]),
      text(". The owner manages billing"),
      schema.nodes["footnote_reference"]!.create({
        "data-id": "fn-billing",
        referenceNumber: "",
      }),
      text(" and seats."),
    ),

    h(2, "Onboarding checklist "),
    schema.nodes["anchor"]!.create({ id: "checklist" }),
    para(
      text("Use "),
      text("@", [code]),
      text(" to assign someone, or "),
      text("/", [code]),
      text(" to insert a block. Drop a date pill anywhere a deadline matters."),
    ),
    node("task_list", null, [
      node(
        "task_item",
        { checked: false },
        para(
          text("Invite teammates by "),
          schema.nodes["date"]!.create({ value: "2026-05-14" }),
          text(" — "),
          schema.nodes["mention"]!.create({ id: "alex", label: "Alex" }),
          text(" can help if you get stuck"),
        ),
      ),
      node(
        "task_item",
        { checked: false },
        para(
          text("Connect a data source by "),
          schema.nodes["date"]!.create({ value: "2026-05-21" }),
        ),
      ),
      node(
        "task_item",
        { checked: false },
        para(
          text("Schedule a check-in by "),
          schema.nodes["date"]!.create({ value: "2026-05-28" }),
        ),
      ),
    ]),

    h(2, "Plan summary"),
    para(
      text("Your "),
      schema.nodes["variable"]!.create({ name: "plan", defaultValue: "Pro" }),
      text(" plan includes the items below. The base rate is the same as last quarter — the formula is "),
      schema.nodes["inline_math"]!.create({ latex: "P = b \\cdot s + u" }),
      text(" where "),
      text("b", [italic]),
      text(" is the base, "),
      text("s", [italic]),
      text(" the seat count, and "),
      text("u", [italic]),
      text(" any usage overage."),
    ),
    node("table", null, [
      node("table_row", null, [
        node("table_header", null, para(text("Item"))),
        node("table_header", null, para(text("Detail"))),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Plan"))),
        node(
          "table_cell",
          null,
          para(
            schema.nodes["variable"]!.create({ name: "plan", defaultValue: "Pro" }),
          ),
        ),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Seats"))),
        node(
          "table_cell",
          null,
          para(
            schema.nodes["variable"]!.create({ name: "seats", defaultValue: "10" }),
          ),
        ),
      ]),
      node("table_row", null, [
        node("table_cell", null, para(text("Renews"))),
        node(
          "table_cell",
          null,
          para(
            schema.nodes["date"]!.create({ value: "2027-05-07" }),
          ),
        ),
      ]),
    ]),

    h(2, "Get help"),
    para(
      text("Email us, or read the "),
      text("docs", [link("https://example.com/docs")]),
      text(". Skip ahead to "),
      text("the checklist", [link("#checklist")]),
      text(" — anchors make in-doc links feel like a website."),
    ),

    node("footnotes", null, [
      node(
        "footnote",
        { "data-id": "fn-billing", id: "fn:1" },
        para(
          text("Owners can transfer billing to another seat at any time from "),
          text("Settings → Billing", [code]),
          text("."),
        ),
      ),
    ]),
  ]);
}
