/**
 * Text Prompt — completer (student-facing). A standalone React component over
 * the typed `TextPromptDef`: no ProseMirror. Owns its own response state (the
 * typed answer) — contained to this block.
 *
 *   • "short" → a single-line input.
 *   • "long"  → a multi-line textarea the student can resize (resize: vertical).
 *
 * Free-response, so there's no answer key and nothing to grade — but the typed
 * answer is still persisted to the shared grading store (by `itemId`) so it
 * survives page navigation and a future publish/collect step can read it.
 */

import { useState } from "react";

import { useRenderBlocks } from "../shared/blockRenderer";
import { useItemGrading } from "../shared/grading";
import type { CompleterProps } from "../types";
import { TEXT_PROMPT_DEFAULT_PLACEHOLDER } from "./schema";
import type { TextPromptDef } from "./serialize";

export function TextPromptCompleter({ def }: CompleterProps<TextPromptDef>) {
  const { variant, fieldWidth, placeholder, itemId } = def;
  const renderBlocks = useRenderBlocks();
  const { initialResponse, persist } = useItemGrading(itemId);
  const [value, setValue] = useState(() => (initialResponse as string) ?? "");
  const onChange = (v: string) => {
    setValue(v);
    persist(v);
  };

  const ph = placeholder || TEXT_PROMPT_DEFAULT_PLACEHOLDER;

  return (
    <div className="pp-text-prompt-completer" data-variant={variant}>
      <div className="pp-text-prompt-completer-prompt">
        {renderBlocks(def.prompt)}
      </div>
      {variant === "long" ? (
        <textarea
          className="pp-text-prompt-input -long"
          name={`text-prompt-${itemId}`}
          placeholder={ph}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text"
          className={`pp-text-prompt-input -short -${fieldWidth}`}
          name={`text-prompt-${itemId}`}
          placeholder={ph}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
