import { Minus } from "@phosphor-icons/react";
import { InputRule } from "prosemirror-inputrules";
import type { NodeType } from "prosemirror-model";
import type { Command } from "prosemirror-state";

import { Extension } from "../types";

function insertHorizontalRule(hrType: NodeType): Command {
  return (state, dispatch) => {
    if (dispatch) {
      dispatch(state.tr.replaceSelectionWith(hrType.create()).scrollIntoView());
    }
    return true;
  };
}

export const HorizontalRule = Extension.create({
  name: "horizontal-rule",
  commands: {
    "horizontal-rule": (schema) => insertHorizontalRule(schema.nodes["horizontal_rule"]!),
  },
  inputRules: (schema) => {
    const hrType = schema.nodes["horizontal_rule"];
    if (!hrType) return [];
    return [
      new InputRule(/^(?:---|\*\*\*|___)\s$/, (state, _match, start, end) => {
        return state.tr.replaceRangeWith(start, end, hrType.create()).scrollIntoView();
      }),
    ];
  },
  meta: { label: "Horizontal rule", group: "block", Icon: Minus },
});
