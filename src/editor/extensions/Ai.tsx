import {
  ArrowClockwise,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ListBullets,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Sparkle,
  Stop,
  Subtract,
  TextAa,
  X,
} from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { Fragment } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  TextSelection,
  type Command,
  type EditorState,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension, type Extension as ExtensionType } from "../types";
import { hideAiCaret, showAiCaret } from "./AiCaret";

// ────────────────────────────────────────────────────────────── Types

export type AiStatus = "idle" | "streaming" | "done" | "error";

export type AiPresetMode =
  | "rephrase"
  | "shorten"
  | "extend"
  | "fix-grammar"
  | "summarize"
  | "tldr"
  | "tone-formal"
  | "tone-casual"
  | "translate";

/**
 * A pending change the AI has produced. The original `range` content
 * stays in the doc and the proposed `replacement` renders as a widget
 * decoration next to it; accepting swaps them, rejecting drops the
 * suggestion. Multiple suggestions can coexist (proofread-style).
 */
export interface Suggestion {
  id: string;
  /** Original range in the live doc — mapped forward across edits. */
  range: { from: number; to: number };
  /** What replaces the range. Streamed in incrementally. */
  replacement: string;
  /** True while chunks are still arriving. */
  streaming: boolean;
  /** Provenance — used by `aiRegenerate` to re-issue the same request. */
  generatedWith?: {
    mode?: AiPresetMode;
    instruction?: string;
    language?: string;
  };
}

export interface AiState {
  status: AiStatus;
  suggestions: Suggestion[];
  selectedSuggestionId: string | null;
  error: string | null;
  /**
   * Bumped by `aiOpenDock` so the dock's React effect can react and
   * focus the textarea even when already expanded.
   */
  focusTick: number;
  /**
   * Selection range remembered when the dock opened. The dock loses
   * selection focus when its textarea takes over, so we stash the range
   * here and read it back when the user submits a preset mode.
   */
  dockSelection: { from: number; to: number } | null;
  /**
   * Stage label driving the dock's "thinking" status text.
   *  - "thinking" → "AI is thinking…"
   *  - "reading"  → "Reading document"
   *  - "editing"  → "Applying edits"
   */
  thinkingStage: "thinking" | "reading" | "editing";
}

export interface AiExample {
  value: string;
  label: string;
  icon?: ComponentType<{ size?: number; weight?: "regular" | "bold" }>;
  keywords?: string[];
  prompt?: string;
  mode?: AiPresetMode;
  language?: string;
  /**
   * When true, the example fires a structured-edit request that may
   * produce multiple suggestions across the whole document (proofread,
   * style review, etc.) instead of a single replacement.
   */
  structured?: boolean;
}

export interface AiOptions {
  baseUrl?: string;
  examples?: AiExample[];
}

export interface AiRequestOptions {
  mode?: AiPresetMode;
  instruction?: string;
  language?: string;
  baseUrl?: string;
  signal?: AbortSignal;
  /** Re-issue the same request that produced `suggestionId`. */
  regenerate?: { suggestionId: string };
  /**
   * Composed natural-language description of the editor's schema —
   * gives the model context about which custom nodes/marks exist so
   * structured edits can target them. See `composeSchemaAwareness`.
   */
  schemaAwareness?: string;
}

/**
 * Walk the installed extensions and join each `schemaAwareness` blurb
 * into one string. Sent to the backend on every AI request so the
 * model knows what nodes/marks the editor supports.
 */
export function composeSchemaAwareness(
  extensions: readonly ExtensionType[],
): string {
  const parts: string[] = [];
  for (const ext of extensions) {
    if (!ext.schemaAwareness) continue;
    const heading = ext.meta?.label ?? ext.name;
    parts.push(`### ${heading}\n${ext.schemaAwareness.trim()}`);
  }
  return parts.join("\n\n");
}

interface AiMeta {
  type:
    | "start-suggestion"
    | "append-suggestion"
    | "settle-suggestion"
    | "remove-suggestion"
    | "select-suggestion"
    | "set-stage"
    | "error"
    | "reset"
    | "open-dock"
    | "close-dock";
  suggestionId?: string;
  range?: { from: number; to: number };
  text?: string;
  selection?: { from: number; to: number } | null;
  stage?: AiState["thinkingStage"];
  message?: string;
  generatedWith?: Suggestion["generatedWith"];
}

const INITIAL_STATE: AiState = {
  status: "idle",
  suggestions: [],
  selectedSuggestionId: null,
  error: null,
  focusTick: 0,
  dockSelection: null,
  thinkingStage: "thinking",
};

export const aiPluginKey = new PluginKey<AiState>("pp-ai");

const DEFAULT_BASE_URL = "http://localhost:3001/api/ai";

function nextSuggestionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Math.random().toString(36).slice(2, 10)}`;
}

function mapRange(
  range: { from: number; to: number },
  mapping: import("prosemirror-transform").Mapping,
): { from: number; to: number } {
  return {
    from: mapping.map(range.from, -1),
    to: mapping.map(range.to, 1),
  };
}

// ────────────────────────────────────────────────────────────── Decorations

function buildSuggestionDecorations(
  state: EditorState,
  ai: AiState,
): DecorationSet {
  const decos: Decoration[] = [];
  for (const sugg of ai.suggestions) {
    const isSelected = sugg.id === ai.selectedSuggestionId;
    const baseClass =
      "pp-ai-suggestion" +
      (isSelected ? " pp-ai-suggestion--selected" : "") +
      (sugg.streaming ? " pp-ai-suggestion--streaming" : "");

    // Existing range overlay (only if the original isn't empty — for
    // pure-insertion suggestions there's nothing to underline).
    if (sugg.range.to > sugg.range.from) {
      decos.push(
        Decoration.inline(sugg.range.from, sugg.range.to, {
          class: baseClass,
          "data-suggestion-id": sugg.id,
        }),
      );
    }

    // Replacement widget — rendered next to the original range. While
    // streaming we paint each chunk as it arrives.
    if (sugg.replacement.length > 0 || sugg.streaming) {
      const widget = document.createElement("span");
      widget.className =
        "pp-ai-suggestion-diff" +
        (isSelected ? " pp-ai-suggestion-diff--selected" : "") +
        (sugg.streaming ? " pp-ai-suggestion-diff--streaming" : "");
      widget.dataset["suggestionId"] = sugg.id;
      widget.textContent = sugg.replacement;
      widget.addEventListener("mousedown", (event) => {
        event.preventDefault();
      });
      decos.push(
        Decoration.widget(sugg.range.to, widget, {
          side: 1,
          key: `sugg-${sugg.id}`,
          ignoreSelection: true,
        }),
      );
    }
  }
  return decos.length === 0
    ? DecorationSet.empty
    : DecorationSet.create(state.doc, decos);
}

// ────────────────────────────────────────────────────────────── Plugin

function aiPlugin(): Plugin<AiState> {
  return new Plugin<AiState>({
    key: aiPluginKey,
    state: {
      init: () => INITIAL_STATE,
      apply(tr, prev): AiState {
        // Map suggestion ranges + dockSelection forward.
        const mappedSuggestions = prev.suggestions.map((s) => ({
          ...s,
          range: mapRange(s.range, tr.mapping),
        }));
        const mappedDockSelection = prev.dockSelection
          ? mapRange(prev.dockSelection, tr.mapping)
          : null;
        const next: AiState = {
          ...prev,
          suggestions: mappedSuggestions,
          dockSelection: mappedDockSelection,
        };

        const meta = tr.getMeta(aiPluginKey) as AiMeta | undefined;
        if (!meta) return next;

        switch (meta.type) {
          case "start-suggestion": {
            const suggestion: Suggestion = {
              id: meta.suggestionId ?? nextSuggestionId(),
              range: meta.range ?? { from: 0, to: 0 },
              replacement: "",
              streaming: true,
              generatedWith: meta.generatedWith,
            };
            return {
              ...next,
              status: "streaming",
              error: null,
              suggestions: [...next.suggestions, suggestion],
              selectedSuggestionId: suggestion.id,
            };
          }
          case "append-suggestion": {
            if (!meta.suggestionId || meta.text == null) return next;
            return {
              ...next,
              suggestions: next.suggestions.map((s) =>
                s.id === meta.suggestionId
                  ? { ...s, replacement: s.replacement + meta.text }
                  : s,
              ),
            };
          }
          case "settle-suggestion": {
            const updated = next.suggestions.map((s) =>
              s.id === meta.suggestionId ? { ...s, streaming: false } : s,
            );
            const stillStreaming = updated.some((s) => s.streaming);
            return {
              ...next,
              status: stillStreaming ? "streaming" : "done",
              suggestions: updated,
            };
          }
          case "remove-suggestion": {
            const remaining = next.suggestions.filter(
              (s) => s.id !== meta.suggestionId,
            );
            return {
              ...next,
              suggestions: remaining,
              status: remaining.length === 0
                ? "idle"
                : remaining.some((s) => s.streaming)
                  ? "streaming"
                  : "done",
              selectedSuggestionId:
                next.selectedSuggestionId === meta.suggestionId
                  ? remaining[0]?.id ?? null
                  : next.selectedSuggestionId,
            };
          }
          case "select-suggestion":
            return {
              ...next,
              selectedSuggestionId: meta.suggestionId ?? null,
            };
          case "set-stage":
            return { ...next, thinkingStage: meta.stage ?? "thinking" };
          case "error":
            return {
              ...next,
              status: "error",
              error: meta.message ?? "AI request failed",
            };
          case "reset":
            return { ...INITIAL_STATE, focusTick: next.focusTick };
          case "open-dock":
            return {
              ...next,
              focusTick: next.focusTick + 1,
              dockSelection: meta.selection ?? next.dockSelection,
            };
          case "close-dock":
            return { ...next, dockSelection: null };
          default:
            return next;
        }
      },
    },
    props: {
      decorations(state) {
        const ai = aiPluginKey.getState(state);
        if (!ai) return null;
        return buildSuggestionDecorations(state, ai);
      },
    },
  });
}

// ────────────────────────────────────────────────────────────── Streaming

export async function runAiRequest(
  view: EditorView,
  options: AiRequestOptions & { baseUrl?: string },
): Promise<void> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  let range: { from: number; to: number };
  let sourceText: string;
  let suggestionId: string;
  let regeneratingExisting: Suggestion | undefined;

  if (options.regenerate) {
    const ai = aiPluginKey.getState(view.state);
    regeneratingExisting = ai?.suggestions.find(
      (s) => s.id === options.regenerate!.suggestionId,
    );
    if (!regeneratingExisting) return;
    // Drop the existing suggestion before we kick a new stream.
    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "remove-suggestion",
        suggestionId: regeneratingExisting.id,
      } satisfies AiMeta),
    );
    range = regeneratingExisting.range;
    sourceText = view.state.doc.textBetween(range.from, range.to, "\n", "\n");
    suggestionId = nextSuggestionId();
  } else {
    // Prefer the live PM selection; otherwise fall back to the
    // dockSelection we stashed when the dock opened.
    const ai = aiPluginKey.getState(view.state);
    const live = view.state.selection.empty
      ? null
      : { from: view.state.selection.from, to: view.state.selection.to };
    const captured = live ?? ai?.dockSelection ?? null;
    range = captured ?? {
      from: view.state.selection.from,
      to: view.state.selection.from,
    };
    sourceText =
      range.to > range.from
        ? view.state.doc.textBetween(range.from, range.to, "\n", "\n")
        : "";
    suggestionId = nextSuggestionId();
  }

  const generatedWith = regeneratingExisting?.generatedWith ?? {
    mode: options.mode,
    instruction: options.instruction,
    language: options.language,
  };

  view.dispatch(
    view.state.tr.setMeta(aiPluginKey, {
      type: "start-suggestion",
      suggestionId,
      range,
      generatedWith,
    } satisfies AiMeta),
  );

  // AI caret marks where text is being inserted while streaming.
  showAiCaret(range.to)(view.state, view.dispatch);

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: sourceText || generatedWith.instruction || "",
        instruction: generatedWith.instruction,
        mode: generatedWith.mode,
        language: generatedWith.language,
        schemaAwareness: options.schemaAwareness ?? "",
      }),
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      const errBody = await response.text().catch(() => "");
      throw new Error(
        `AI request failed (${response.status}) ${errBody.slice(0, 200)}`,
      );
    }

    const reader = response.body
      .pipeThrough(new TextDecoderStream())
      .getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      view.dispatch(
        view.state.tr
          .setMeta(aiPluginKey, {
            type: "append-suggestion",
            suggestionId,
            text: value,
          } satisfies AiMeta)
          .setMeta("addToHistory", false),
      );
    }

    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "settle-suggestion",
        suggestionId,
      } satisfies AiMeta),
    );
    hideAiCaret()(view.state, view.dispatch);
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      view.dispatch(
        view.state.tr.setMeta(aiPluginKey, {
          type: "remove-suggestion",
          suggestionId,
        } satisfies AiMeta),
      );
      hideAiCaret()(view.state, view.dispatch);
      return;
    }
    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "error",
        message: (err as Error)?.message ?? "AI request failed",
      } satisfies AiMeta),
    );
    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "remove-suggestion",
        suggestionId,
      } satisfies AiMeta),
    );
    hideAiCaret()(view.state, view.dispatch);
  }
}

// ────────────────────────────────────────────────────────────── Structured edits

interface StructuredEditOperation {
  type: "replace" | "insertBefore" | "insertAfter";
  target: string;
  content: string;
  meta?: string;
}

/**
 * Walk the doc and collect every block node that carries an `id`
 * attribute (assigned by the UniqueID extension). Used to feed the
 * structured-edit backend a list of editable blocks with stable ids.
 */
function collectBlocks(state: EditorState): Array<{
  id: string;
  text: string;
  from: number;
  to: number;
}> {
  const blocks: Array<{ id: string; text: string; from: number; to: number }> = [];
  state.doc.descendants((node, pos) => {
    if (!node.isBlock || !node.isTextblock) return true;
    const id = node.attrs["id"];
    if (typeof id !== "string" || !id) return true;
    blocks.push({
      id,
      text: node.textContent,
      from: pos + 1,
      to: pos + 1 + node.content.size,
    });
    return false;
  });
  return blocks;
}

/**
 * Drive a structured-edit request. POSTs the doc's id-keyed blocks +
 * an instruction to `/api/ai/edit`, parses the response, and creates
 * one Suggestion per returned operation.
 *
 * Replace ops produce a Suggestion over the matched block's range.
 * insertBefore / insertAfter ops produce zero-width Suggestions whose
 * replacement is the new content (accept inserts at the boundary).
 */
export async function runStructuredEditRequest(
  view: EditorView,
  options: {
    instruction: string;
    baseUrl?: string;
    schemaAwareness?: string;
    signal?: AbortSignal;
  },
): Promise<void> {
  const baseUrl = options.baseUrl ?? `${DEFAULT_BASE_URL}/edit`;
  const blocks = collectBlocks(view.state);
  if (blocks.length === 0) return;

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction: options.instruction,
        blocks: blocks.map(({ id, text }) => ({ id, text })),
        schemaAwareness: options.schemaAwareness ?? "",
      }),
      signal: options.signal,
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => "");
      throw new Error(`Structured edit failed (${response.status}) ${err.slice(0, 200)}`);
    }

    // Buffer the streaming JSON. The AI SDK's streamObject emits the
    // partial object repeatedly; we just wait for the final value.
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) buffer += value;
    }

    let parsed: { operations?: StructuredEditOperation[] } | null = null;
    try {
      parsed = JSON.parse(buffer);
    } catch {
      // Try to find the last complete JSON object in the buffer.
      const lastBrace = buffer.lastIndexOf("}");
      if (lastBrace > 0) {
        try {
          parsed = JSON.parse(buffer.slice(0, lastBrace + 1));
        } catch {
          // give up
        }
      }
    }
    if (!parsed?.operations) return;

    // Re-collect blocks at apply time so positions reflect any edits
    // that landed in between.
    const liveBlocks = new Map(
      collectBlocks(view.state).map((b) => [b.id, b]),
    );
    for (const op of parsed.operations) {
      const block = liveBlocks.get(op.target);
      if (!block) continue;
      let range: { from: number; to: number };
      switch (op.type) {
        case "replace":
          range = { from: block.from, to: block.to };
          break;
        case "insertBefore":
          range = { from: block.from - 1, to: block.from - 1 };
          break;
        case "insertAfter":
          range = { from: block.to + 1, to: block.to + 1 };
          break;
      }
      const suggestionId = nextSuggestionId();
      view.dispatch(
        view.state.tr.setMeta(aiPluginKey, {
          type: "start-suggestion",
          suggestionId,
          range,
          generatedWith: { instruction: options.instruction },
        } satisfies AiMeta),
      );
      view.dispatch(
        view.state.tr.setMeta(aiPluginKey, {
          type: "append-suggestion",
          suggestionId,
          text: op.content,
        } satisfies AiMeta),
      );
      view.dispatch(
        view.state.tr.setMeta(aiPluginKey, {
          type: "settle-suggestion",
          suggestionId,
        } satisfies AiMeta),
      );
    }
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return;
    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "error",
        message: (err as Error)?.message ?? "Structured edit failed",
      } satisfies AiMeta),
    );
  }
}

// ────────────────────────────────────────────────────────────── Commands

/**
 * Apply a suggestion's replacement to the underlying range, then drop
 * it from plugin state.
 */
export function aiAcceptSuggestion(suggestionId: string): Command {
  return (state, dispatch) => {
    const ai = aiPluginKey.getState(state);
    const sugg = ai?.suggestions.find((s) => s.id === suggestionId);
    if (!sugg || sugg.streaming) return false;
    if (!dispatch) return true;
    let tr = state.tr.replaceWith(
      sugg.range.from,
      sugg.range.to,
      sugg.replacement
        ? Fragment.from(state.schema.text(sugg.replacement))
        : Fragment.empty,
    );
    tr = tr.setMeta(aiPluginKey, {
      type: "remove-suggestion",
      suggestionId,
    } satisfies AiMeta);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export function aiRejectSuggestion(suggestionId: string): Command {
  return (state, dispatch) => {
    const ai = aiPluginKey.getState(state);
    const sugg = ai?.suggestions.find((s) => s.id === suggestionId);
    if (!sugg) return false;
    if (!dispatch) return true;
    dispatch(
      state.tr.setMeta(aiPluginKey, {
        type: "remove-suggestion",
        suggestionId,
      } satisfies AiMeta),
    );
    return true;
  };
}

export function aiAcceptAll(): Command {
  return (state, dispatch) => {
    const ai = aiPluginKey.getState(state);
    if (!ai || ai.suggestions.length === 0) return false;
    if (!dispatch) return true;
    // Apply right-to-left so earlier indices stay valid.
    const sorted = [...ai.suggestions].sort(
      (a, b) => b.range.from - a.range.from,
    );
    let tr = state.tr;
    for (const sugg of sorted) {
      if (sugg.streaming) continue;
      const from = tr.mapping.map(sugg.range.from, -1);
      const to = tr.mapping.map(sugg.range.to, 1);
      tr = tr.replaceWith(
        from,
        to,
        sugg.replacement
          ? Fragment.from(state.schema.text(sugg.replacement))
          : Fragment.empty,
      );
    }
    tr = tr.setMeta(aiPluginKey, { type: "reset" } satisfies AiMeta);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

export function aiRejectAll(): Command {
  return (state, dispatch) => {
    const ai = aiPluginKey.getState(state);
    if (!ai || ai.suggestions.length === 0) return false;
    if (!dispatch) return true;
    dispatch(state.tr.setMeta(aiPluginKey, { type: "reset" } satisfies AiMeta));
    return true;
  };
}

export function aiSelectSuggestion(suggestionId: string | null): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    dispatch(
      state.tr.setMeta(aiPluginKey, {
        type: "select-suggestion",
        suggestionId: suggestionId ?? undefined,
      } satisfies AiMeta),
    );
    return true;
  };
}

export function aiOpenDock(): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    const { selection } = state;
    const stored = !selection.empty
      ? { from: selection.from, to: selection.to }
      : null;
    dispatch(
      state.tr.setMeta(aiPluginKey, {
        type: "open-dock",
        selection: stored,
      } satisfies AiMeta),
    );
    return true;
  };
}

export function aiCloseDock(): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    dispatch(
      state.tr.setMeta(aiPluginKey, {
        type: "close-dock",
      } satisfies AiMeta),
    );
    return true;
  };
}

// ────────────────────────────────────────────────────────────── React hook

export interface UseAiResult {
  state: AiState;
  status: AiStatus;
  isStreaming: boolean;
  hasSuggestions: boolean;
  hasError: boolean;
  suggestions: Suggestion[];
  selectedSuggestion: Suggestion | null;
  prompt: (instruction: string) => Promise<void>;
  transform: (mode: AiPresetMode, options?: { language?: string }) => Promise<void>;
  /**
   * Send the doc's id-keyed blocks + an instruction to /api/ai/edit
   * and create one Suggestion per returned operation. Useful for
   * proofread / multi-block edit passes.
   */
  structuredEdit: (instruction: string) => Promise<void>;
  regenerate: (suggestionId: string) => Promise<void>;
  accept: (suggestionId: string) => void;
  reject: (suggestionId: string) => void;
  acceptAll: () => void;
  rejectAll: () => void;
  select: (suggestionId: string | null) => void;
  cancel: () => void;
  openDock: () => void;
  closeDock: () => void;
}

export function useAi(options: AiOptions = {}): UseAiResult {
  const editorState = useEditorState();
  const editorHandle = useEditor();
  const ai = editorState
    ? (aiPluginKey.getState(editorState) ?? INITIAL_STATE)
    : INITIAL_STATE;
  const abortRef = useRef<AbortController | null>(null);

  const schemaAwareness = useMemo(
    () => composeSchemaAwareness(editorHandle.extensions),
    [editorHandle.extensions],
  );

  const start = useEditorEventCallback(
    async (view: EditorView | null, opts: AiRequestOptions) => {
      if (!view) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      await runAiRequest(view, {
        ...opts,
        baseUrl: opts.baseUrl ?? options.baseUrl,
        schemaAwareness: opts.schemaAwareness ?? schemaAwareness,
        signal: ac.signal,
      });
    },
  );

  const structuredEdit = useEditorEventCallback(
    async (view: EditorView | null, instruction: string) => {
      if (!view) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const editBaseUrl = options.baseUrl
        ? `${options.baseUrl}/edit`
        : undefined;
      await runStructuredEditRequest(view, {
        instruction,
        baseUrl: editBaseUrl,
        schemaAwareness,
        signal: ac.signal,
      });
    },
  );

  const accept = useEditorEventCallback(
    (view: EditorView | null, suggestionId: string) => {
      if (!view) return;
      aiAcceptSuggestion(suggestionId)(view.state, view.dispatch);
      view.focus();
    },
  );

  const reject = useEditorEventCallback(
    (view: EditorView | null, suggestionId: string) => {
      if (!view) return;
      aiRejectSuggestion(suggestionId)(view.state, view.dispatch);
      view.focus();
    },
  );

  const acceptAll = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiAcceptAll()(view.state, view.dispatch);
    view.focus();
  });

  const rejectAll = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiRejectAll()(view.state, view.dispatch);
    view.focus();
  });

  const select = useEditorEventCallback(
    (view: EditorView | null, suggestionId: string | null) => {
      if (!view) return;
      aiSelectSuggestion(suggestionId)(view.state, view.dispatch);
    },
  );

  const cancel = useEditorEventCallback((view: EditorView | null) => {
    abortRef.current?.abort();
    if (!view) return;
    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, { type: "reset" } satisfies AiMeta),
    );
  });

  const openDock = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiOpenDock()(view.state, view.dispatch);
  });

  const closeDock = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiCloseDock()(view.state, view.dispatch);
  });

  const selectedSuggestion =
    ai.suggestions.find((s) => s.id === ai.selectedSuggestionId) ?? null;

  return {
    state: ai,
    status: ai.status,
    isStreaming: ai.status === "streaming",
    hasSuggestions: ai.suggestions.length > 0,
    hasError: ai.status === "error",
    suggestions: ai.suggestions,
    selectedSuggestion,
    prompt: (instruction) => start({ instruction }),
    transform: (mode, opts) => start({ mode, language: opts?.language }),
    structuredEdit,
    regenerate: (suggestionId) => start({ regenerate: { suggestionId } }),
    accept,
    reject,
    acceptAll,
    rejectAll,
    select,
    cancel,
    openDock,
    closeDock,
  };
}

// ────────────────────────────────────────────────────────────── Toolbar

interface AiToolbarItemProps {
  baseUrl?: string;
  examples?: AiExample[];
}

function AiToolbarItem({ baseUrl, examples }: AiToolbarItemProps) {
  const ai = useAi({ baseUrl, examples });
  return (
    <MenuItem
      active={ai.isStreaming || ai.hasSuggestions}
      onClick={ai.openDock}
      tooltip="Ask AI"
      shortcut="⌘J"
    >
      <Sparkle size={18} weight="bold" />
    </MenuItem>
  );
}

// ────────────────────────────────────────────────────────────── Default examples

const DEFAULT_EXAMPLES: AiExample[] = [
  { value: "rephrase", label: "Rephrase", mode: "rephrase", icon: PencilSimple, keywords: ["reword", "paraphrase"] },
  { value: "shorten", label: "Shorten", mode: "shorten", icon: Subtract, keywords: ["trim", "tighten"] },
  { value: "extend", label: "Extend", mode: "extend", icon: Plus, keywords: ["expand", "lengthen"] },
  { value: "fix-grammar", label: "Fix grammar & spelling (selection)", mode: "fix-grammar", icon: MagnifyingGlass, keywords: ["proofread", "grammar", "spelling"] },
  {
    value: "proofread-doc",
    label: "Proofread whole document",
    icon: MagnifyingGlass,
    keywords: ["proofread", "review", "grammar", "spelling", "doc"],
    prompt: "Find any spelling, grammar, or punctuation errors anywhere in the document and propose fixes. Only return operations for blocks that need changes.",
    structured: true,
  },
  { value: "summarize", label: "Summarize", mode: "summarize", icon: ListBullets, keywords: ["summary"] },
  { value: "tldr", label: "TL;DR", mode: "tldr", icon: TextAa, keywords: ["tldr", "tl;dr"] },
];

function filterExamples(items: AiExample[], query: string): AiExample[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.label.toLowerCase().includes(q)) return true;
    if (item.value.includes(q)) return true;
    return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
  });
}

// ────────────────────────────────────────────────────────────── AI dock

interface AiDockProps {
  baseUrl?: string;
  examples?: AiExample[];
}

/**
 * Persistent bottom panel. When suggestions exist, swaps to the review
 * nav. Otherwise renders the prompt dock with three states (collapsed,
 * focused, processing).
 */
export function AiDock({ baseUrl, examples }: AiDockProps = {}) {
  const ai = useAi({ baseUrl, examples });
  const items = examples ?? DEFAULT_EXAMPLES;

  // Review-nav supersedes the prompt dock whenever suggestions exist.
  if (ai.hasSuggestions) {
    return createPortal(
      <div className="pp-ai-dock-floating" data-position="bottom">
        <AiSuggestionsNav ai={ai} />
      </div>,
      document.body,
    );
  }

  return <AiPromptDock ai={ai} examples={items} />;
}

interface AiPromptDockProps {
  ai: UseAiResult;
  examples: AiExample[];
}

function AiPromptDock({ ai, examples }: AiPromptDockProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [draft, setDraft] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTick = ai.state.focusTick;

  useEffect(() => {
    if (focusTick === 0) return;
    setCollapsed(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [focusTick]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [draft, collapsed]);

  useEffect(() => {
    if (collapsed) return;
    const el = wrapperRef.current;
    if (!el) return;
    const onFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && el.contains(next)) return;
      if (draft.trim()) return;
      setCollapsed(true);
    };
    el.addEventListener("focusout", onFocusOut);
    return () => el.removeEventListener("focusout", onFocusOut);
  }, [collapsed, draft]);

  // Once a stream starts, the dock collapses so the suggestion review
  // takes over.
  useEffect(() => {
    if (ai.isStreaming) {
      setCollapsed(true);
      setDraft("");
    }
  }, [ai.isStreaming]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void ai.prompt(text);
  }, [draft, ai]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft("");
        textareaRef.current?.blur();
        ai.closeDock();
        setCollapsed(true);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!draft.trim()) return;
        submit();
      }
    },
    [draft, submit, ai],
  );

  const runExample = useCallback(
    (example: AiExample) => {
      setDraft("");
      setCollapsed(true);
      if (example.structured && example.prompt) {
        void ai.structuredEdit(example.prompt);
      } else if (example.mode) {
        void ai.transform(example.mode, { language: example.language });
      } else if (example.prompt) {
        void ai.prompt(example.prompt);
      }
    },
    [ai],
  );

  if (ai.isStreaming) {
    return createPortal(
      <div className="pp-ai-dock-floating" data-position="bottom">
        <div className="pp-ai-dock pp-ai-dock-processing">
          <div className="pp-ai-spinner-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <span className="pp-ai-dock-status">
            {stageLabel(ai.state.thinkingStage)}
          </span>
          <button
            type="button"
            className="pp-ai-dock-btn pp-ai-dock-btn-ghost"
            onClick={ai.cancel}
            title="Stop"
          >
            <Stop size={14} weight="bold" />
            Stop
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  if (collapsed) {
    return createPortal(
      <div className="pp-ai-dock-floating" data-position="bottom">
        <button
          type="button"
          className="pp-ai-dock pp-ai-dock-collapsed"
          onClick={() => {
            setCollapsed(false);
            requestAnimationFrame(() => textareaRef.current?.focus());
          }}
        >
          <Sparkle size={16} weight="bold" className="pp-ai-dock-icon" />
          <span className="pp-ai-dock-placeholder">
            Tell AI what else needs to be changed…
          </span>
          <span
            className="pp-ai-dock-btn pp-ai-dock-btn-primary pp-ai-dock-btn-disabled"
            aria-hidden="true"
          >
            <ArrowUp size={14} weight="bold" />
          </span>
        </button>
      </div>,
      document.body,
    );
  }

  const filtered = filterExamples(examples, draft);
  const showExamples = filtered.length > 0;

  return createPortal(
    <div className="pp-ai-dock-floating" data-position="bottom">
      {showExamples && (
        <div
          className="pp-ai-dock-examples"
          role="listbox"
          aria-label="AI Toolkit examples"
        >
          <div className="pp-ai-dock-examples-label">AI Toolkit examples</div>
          {filtered.map((item) => (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected="false"
              className="pp-ai-dock-example"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => runExample(item)}
            >
              {item.icon ? (
                <span className="pp-ai-dock-example-icon">
                  <item.icon size={14} weight="bold" />
                </span>
              ) : (
                <span className="pp-ai-dock-example-icon" aria-hidden="true" />
              )}
              <span className="pp-ai-dock-example-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <div ref={wrapperRef} className="pp-ai-dock pp-ai-dock-active" data-focused="true">
        <textarea
          ref={textareaRef}
          className="pp-ai-dock-input"
          placeholder="Edit this document with AI…"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="pp-ai-dock-btn pp-ai-dock-btn-primary"
          onClick={submit}
          disabled={!draft.trim()}
          aria-label="Submit prompt"
        >
          <ArrowUp size={14} weight="bold" />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function stageLabel(stage: AiState["thinkingStage"]): string {
  switch (stage) {
    case "reading":
      return "Reading document";
    case "editing":
      return "Applying edits";
    default:
      return "AI is thinking…";
  }
}

// ────────────────────────────────────────────────────────────── Suggestions nav

interface AiSuggestionsNavProps {
  ai: UseAiResult;
}

function AiSuggestionsNav({ ai }: AiSuggestionsNavProps) {
  const total = ai.suggestions.length;
  const selectedIndex = Math.max(
    0,
    ai.suggestions.findIndex((s) => s.id === ai.state.selectedSuggestionId),
  );
  const current = ai.suggestions[selectedIndex] ?? ai.suggestions[0];

  // Scroll the currently selected suggestion's range into view.
  useScrollSelectedIntoView(current?.id ?? null);

  if (!current) return null;

  const goPrev = () => {
    const prev = ai.suggestions[Math.max(0, selectedIndex - 1)];
    if (prev) ai.select(prev.id);
  };
  const goNext = () => {
    const next = ai.suggestions[Math.min(total - 1, selectedIndex + 1)];
    if (next) ai.select(next.id);
  };

  return (
    <div className="pp-ai-dock pp-ai-dock-review">
      {total > 1 && (
        <>
          <div className="pp-ai-review-bulk">
            <button
              type="button"
              className="pp-ai-dock-btn pp-ai-dock-btn-ghost"
              onClick={ai.rejectAll}
            >
              Reject all
            </button>
            <button
              type="button"
              className="pp-ai-dock-btn pp-ai-dock-btn-ghost"
              onClick={ai.acceptAll}
            >
              Accept all
            </button>
          </div>
          <span className="pp-ai-review-divider" aria-hidden="true" />
          <div className="pp-ai-review-nav">
            <button
              type="button"
              className="pp-ai-dock-btn pp-ai-dock-btn-ghost"
              onClick={goPrev}
              disabled={selectedIndex === 0}
              title="Previous suggestion"
              aria-label="Previous"
            >
              <ArrowLeft size={14} weight="bold" />
            </button>
            <span className="pp-ai-review-counter">
              <strong>{selectedIndex + 1}</strong> / {total}
            </span>
            <button
              type="button"
              className="pp-ai-dock-btn pp-ai-dock-btn-ghost"
              onClick={goNext}
              disabled={selectedIndex >= total - 1}
              title="Next suggestion"
              aria-label="Next"
            >
              <ArrowRight size={14} weight="bold" />
            </button>
          </div>
          <span className="pp-ai-review-divider" aria-hidden="true" />
        </>
      )}
      <div className="pp-ai-review-actions">
        <button
          type="button"
          className="pp-ai-dock-btn pp-ai-dock-btn-ghost"
          onClick={() => ai.regenerate(current.id)}
          title="Regenerate"
          disabled={current.streaming}
        >
          <ArrowClockwise size={14} weight="bold" />
        </button>
        <button
          type="button"
          className="pp-ai-dock-btn pp-ai-dock-btn-reject"
          onClick={() => ai.reject(current.id)}
          title="Reject"
          aria-label="Reject"
        >
          <X size={14} weight="bold" />
          Reject
        </button>
        <button
          type="button"
          className="pp-ai-dock-btn pp-ai-dock-btn-accept"
          onClick={() => ai.accept(current.id)}
          title="Accept"
          aria-label="Accept"
          disabled={current.streaming}
        >
          <Check size={14} weight="bold" />
          Accept
        </button>
      </div>
    </div>
  );
}

function useScrollSelectedIntoView(suggestionId: string | null) {
  useEditorEffect(
    (view) => {
      if (!suggestionId) return;
      const ai = aiPluginKey.getState(view.state);
      const sugg = ai?.suggestions.find((s) => s.id === suggestionId);
      if (!sugg) return;
      try {
        const coords = view.coordsAtPos(
          Math.min(sugg.range.from, view.state.doc.content.size),
        );
        const middle = (coords.top + coords.bottom) / 2;
        const target = middle - window.innerHeight / 2;
        window.scrollBy({ top: target, behavior: "smooth" });
      } catch {
        // out of viewport / disconnected; silently skip
      }
    },
    [suggestionId],
  );
}

// ────────────────────────────────────────────────────────────── Extension factory

export function createAi(options: AiOptions = {}) {
  return Extension.create({
    name: "ai",
    plugins: () => [aiPlugin()],
    toolbar: () => (
      <AiToolbarItem baseUrl={options.baseUrl} examples={options.examples} />
    ),
    meta: { label: "Ask AI", group: "system", Icon: Sparkle },
  });
}

export const Ai = createAi();
