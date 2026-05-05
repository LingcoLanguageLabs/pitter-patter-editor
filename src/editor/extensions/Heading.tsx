import { setBlockType } from "prosemirror-commands";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import type { NodeType, Schema } from "prosemirror-model";
import type { Command } from "prosemirror-state";

import { isTextblockActive } from "../helpers";
import { Extension } from "../types";

function toggleHeading(headingType: NodeType, paragraphType: NodeType, level: number): Command {
  return (state, dispatch, view) => {
    if (isTextblockActive(state, headingType, { level })) {
      return setBlockType(paragraphType)(state, dispatch, view);
    }
    return setBlockType(headingType, { level })(state, dispatch, view);
  };
}

function buildLevelCommand(level: number): (schema: Schema) => Command {
  return (schema) => {
    const headingType = schema.nodes["heading"];
    const paragraphType = schema.nodes["paragraph"];
    if (!headingType || !paragraphType) return () => false;
    return toggleHeading(headingType, paragraphType, level);
  };
}

export const Heading = Extension.create({
  name: "heading",
  commands: {
    "heading-1": buildLevelCommand(1),
    "heading-2": buildLevelCommand(2),
    "heading-3": buildLevelCommand(3),
    "heading-4": buildLevelCommand(4),
  },
  keymap: {
    "Mod-Alt-1": "heading-1",
    "Mod-Alt-2": "heading-2",
    "Mod-Alt-3": "heading-3",
    "Mod-Alt-4": "heading-4",
  },
  inputRules: (schema) => {
    const headingType = schema.nodes["heading"];
    if (!headingType) return [];
    return [
      textblockTypeInputRule(/^(#{1,6})\s$/, headingType, (match) => ({
        level: match[1]!.length,
      })),
    ];
  },
  isActive: (state, schema) => isTextblockActive(state, schema.nodes["heading"]!),
  meta: { label: "Heading", group: "block" },
});
