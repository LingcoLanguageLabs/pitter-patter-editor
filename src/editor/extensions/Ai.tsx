import {
  ArrowClockwise,
  Check,
  Sparkle,
  Stop,
  X,
} from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import * as RadixPopover from "@radix-ui/react-popover";
import { Slice } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEditor } from "../Editor";
import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

// ─────────────────────────────────────────────────── Types

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

export interface AiState {
  status: AiStatus;
  /**
   * The original content the AI is replacing. Captured at start time
   * and restored on reject (and reused as the source on regenerate).
   * `null` for prompt-mode requests with no selection.
   */
  replacedSlice: Slice | null;
  /** Plain-text version of `replacedSlice` — what we send to the model. */
  sourceText: string;
  /** Where the streamed text lives. `from`==`to` until the first chunk arrives. */
  streamRange: { from: number; to: number } | null;
  /** What we asked for — used by aiRegenerate. */
  generatedWith:
    | { mode?: AiPresetMode; instruction?: string; language?: string }
    | null;
  error: string | null;
}

export interface AiOptions {
  /** Backend URL. Defaults to the local dev-server. */
  baseUrl?: string;
}

export interface AiRequestOptions {
  /** Run a preset mode (`rephrase`, `shorten`, …). */
  mode?: AiPresetMode;
  /** Freeform instruction — ignored when `mode` is set. */
  instruction?: string;
  /** Target language for `mode: "translate"`. */
  language?: string;
  /** Override the backend URL for this request. */
  baseUrl?: string;
  /** Abort the request mid-stream. */
  signal?: AbortSignal;
  /**
   * Re-run the previous request, reusing its replacedSlice and source
   * text. Replaces the existing streamed range in place.
   */
  regenerate?: boolean;
}

interface AiMeta {
  type:
    | "start"
    | "chunk"
    | "complete"
    | "error"
    | "accept"
    | "reject"
    | "reset";
  replacedSlice?: Slice | null;
  sourceText?: string;
  streamPos?: number;
  message?: string;
  generatedWith?: AiState["generatedWith"];
}

const INITIAL_STATE: AiState = {
  status: "idle",
  replacedSlice: null,
  sourceText: "",
  streamRange: null,
  generatedWith: null,
  error: null,
};

export const aiPluginKey = new PluginKey<AiState>("pp-ai");

// ─────────────────────────────────────────────────── Plugin

function buildDecorations(state: EditorState, ai: AiState): DecorationSet {
  if (!ai.streamRange) return DecorationSet.empty;
  const { from, to } = ai.streamRange;
  if (from === to) return DecorationSet.empty;
  const className =
    ai.status === "streaming"
      ? "pp-ai-preview pp-ai-preview-streaming"
      : ai.status === "done"
        ? "pp-ai-preview pp-ai-preview-done"
        : "pp-ai-preview pp-ai-preview-error";
  return DecorationSet.create(state.doc, [
    Decoration.inline(from, to, { class: className }),
  ]);
}

function aiPlugin(): Plugin<AiState> {
  return new Plugin<AiState>({
    key: aiPluginKey,
    state: {
      init: () => INITIAL_STATE,
      apply(tr, prev) {
        // Map streamRange forward across every transaction so the
        // decoration tracks edits made while a stream is in flight.
        // bias=-1 on `from` keeps the start anchored; bias=+1 on `to`
        // expands the range to include text inserted at that boundary.
        const mapStream = prev.streamRange
          ? {
              from: tr.mapping.map(prev.streamRange.from, -1),
              to: tr.mapping.map(prev.streamRange.to, 1),
            }
          : null;
        const next: AiState = {
          ...prev,
          streamRange: mapStream,
        };

        const meta = tr.getMeta(aiPluginKey) as AiMeta | undefined;
        if (!meta) return next;

        switch (meta.type) {
          case "start":
            return {
              status: "streaming",
              replacedSlice: meta.replacedSlice ?? null,
              sourceText: meta.sourceText ?? "",
              streamRange: {
                from: meta.streamPos ?? 0,
                to: meta.streamPos ?? 0,
              },
              generatedWith: meta.generatedWith ?? null,
              error: null,
            };
          case "chunk":
            return next;
          case "complete":
            return { ...next, status: "done" };
          case "error":
            return {
              ...next,
              status: "error",
              error: meta.message ?? "AI request failed",
            };
          case "accept":
          case "reject":
          case "reset":
            return INITIAL_STATE;
          default:
            return next;
        }
      },
    },
    props: {
      decorations(state) {
        const ai = aiPluginKey.getState(state);
        if (!ai) return null;
        return buildDecorations(state, ai);
      },
    },
  });
}

// ─────────────────────────────────────────────────── Streaming runner

const DEFAULT_BASE_URL = "http://localhost:3001/api/ai";

export async function runAiRequest(
  view: EditorView,
  options: AiRequestOptions & { baseUrl?: string; regenerate?: boolean },
): Promise<void> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  let replacedSlice: Slice | null = null;
  let sourceText = "";
  let streamPos: number;

  if (options.regenerate) {
    // Reuse the slice + source text from the previous request, delete
    // the existing streamed output, and start over at the same anchor.
    const prev = aiPluginKey.getState(view.state);
    if (!prev?.streamRange) return;
    const { from, to } = prev.streamRange;
    if (to > from) {
      view.dispatch(view.state.tr.delete(from, to));
    }
    streamPos = from;
    replacedSlice = prev.replacedSlice;
    sourceText = prev.sourceText;
  } else {
    const { selection } = view.state;
    if (!selection.empty) {
      // Selection-driven request — replace it in place. Capture the
      // original slice so reject can restore it cleanly.
      replacedSlice = view.state.doc.slice(selection.from, selection.to);
      sourceText = view.state.doc.textBetween(
        selection.from,
        selection.to,
        "\n",
        "\n",
      );
      streamPos = selection.from;
      view.dispatch(view.state.tr.delete(selection.from, selection.to));
    } else {
      // Empty cursor — generate at the caret with no source content.
      streamPos = selection.from;
    }
  }

  view.dispatch(
    view.state.tr.setMeta(aiPluginKey, {
      type: "start",
      replacedSlice,
      sourceText,
      streamPos,
      generatedWith: {
        mode: options.mode,
        instruction: options.instruction,
        language: options.language,
      },
    } satisfies AiMeta),
  );

  try {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: sourceText || (options.instruction ?? ""),
        instruction: options.instruction,
        mode: options.mode,
        language: options.language,
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

      const ai = aiPluginKey.getState(view.state);
      if (!ai?.streamRange) break;

      const at = ai.streamRange.to;
      const tr = view.state.tr.insertText(value, at);
      tr.setMeta(aiPluginKey, { type: "chunk" } satisfies AiMeta);
      tr.setMeta("addToHistory", false);
      view.dispatch(tr);
    }

    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "complete",
      } satisfies AiMeta),
    );
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      // User cancelled — yank the streamed text and return to idle.
      const ai = aiPluginKey.getState(view.state);
      if (ai?.streamRange && ai.streamRange.to > ai.streamRange.from) {
        view.dispatch(
          view.state.tr.delete(ai.streamRange.from, ai.streamRange.to),
        );
      }
      view.dispatch(
        view.state.tr.setMeta(aiPluginKey, {
          type: "reset",
        } satisfies AiMeta),
      );
      return;
    }
    view.dispatch(
      view.state.tr.setMeta(aiPluginKey, {
        type: "error",
        message: (err as Error)?.message ?? "AI request failed",
      } satisfies AiMeta),
    );
  }
}

// ─────────────────────────────────────────────────── Commands

/**
 * Keep the streamed text in place — no doc edit needed because the
 * original was already deleted at start time. Just clear the AI state
 * so the preview decoration disappears.
 */
export function aiAccept(): Command {
  return (state, dispatch) => {
    const ai = aiPluginKey.getState(state);
    if (!ai || ai.status !== "done") return false;
    if (!dispatch) return true;
    dispatch(
      state.tr
        .setMeta(aiPluginKey, { type: "accept" } satisfies AiMeta)
        .scrollIntoView(),
    );
    return true;
  };
}

/**
 * Delete the streamed range and restore the original content if the
 * request replaced a selection.
 */
export function aiReject(): Command {
  return (state, dispatch) => {
    const ai = aiPluginKey.getState(state);
    if (!ai) return false;
    if (
      ai.status !== "done" &&
      ai.status !== "error" &&
      ai.status !== "streaming"
    ) {
      return false;
    }
    if (!dispatch) return true;
    let tr = state.tr;
    if (ai.streamRange && ai.streamRange.to > ai.streamRange.from) {
      tr = tr.delete(ai.streamRange.from, ai.streamRange.to);
    }
    if (ai.replacedSlice && ai.streamRange) {
      tr = tr.replace(
        ai.streamRange.from,
        ai.streamRange.from,
        ai.replacedSlice,
      );
    }
    tr.setMeta(aiPluginKey, { type: "reject" } satisfies AiMeta);
    dispatch(tr.scrollIntoView());
    return true;
  };
}

// ─────────────────────────────────────────────────── React hook

export interface UseAiResult {
  state: AiState;
  status: AiStatus;
  isStreaming: boolean;
  isDone: boolean;
  hasError: boolean;
  /** Run a freeform instruction against the selection (or just the prompt). */
  prompt: (instruction: string) => Promise<void>;
  /** Run a preset mode against the selection. */
  transform: (mode: AiPresetMode, options?: { language?: string }) => Promise<void>;
  /** Re-run the same request that produced the current preview. */
  regenerate: () => Promise<void>;
  /** Strip the preview decoration and (if a selection drove the request) delete the original text. */
  accept: () => void;
  /** Delete the streamed range and restore the original. */
  reject: () => void;
  /** Abort the in-flight request and roll back any partial output. */
  cancel: () => void;
}

export function useAi(options: AiOptions = {}): UseAiResult {
  const editorState = useEditorState();
  const ai = editorState
    ? (aiPluginKey.getState(editorState) ?? INITIAL_STATE)
    : INITIAL_STATE;
  const abortRef = useRef<AbortController | null>(null);

  const start = useEditorEventCallback(
    async (view: EditorView | null, opts: AiRequestOptions) => {
      if (!view) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      await runAiRequest(view, {
        ...opts,
        baseUrl: opts.baseUrl ?? options.baseUrl,
        signal: ac.signal,
      });
    },
  );

  const accept = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiAccept()(view.state, view.dispatch);
    view.focus();
  });

  const reject = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    abortRef.current?.abort();
    aiReject()(view.state, view.dispatch);
    view.focus();
  });

  const cancel = useEditorEventCallback((view: EditorView | null) => {
    abortRef.current?.abort();
    if (view) {
      aiReject()(view.state, view.dispatch);
    }
  });

  return {
    state: ai,
    status: ai.status,
    isStreaming: ai.status === "streaming",
    isDone: ai.status === "done",
    hasError: ai.status === "error",
    prompt: (instruction) => start({ instruction }),
    transform: (mode, opts) => start({ mode, language: opts?.language }),
    regenerate: async () => {
      const generatedWith = ai.generatedWith;
      if (!generatedWith) return;
      // `regenerate: true` reuses the captured replacedSlice + source
      // text and overwrites the previous streamed output in place —
      // no need to round-trip through reject + restart.
      await start({
        mode: generatedWith.mode,
        instruction: generatedWith.instruction,
        language: generatedWith.language,
        regenerate: true,
      });
    },
    accept,
    reject,
    cancel,
  };
}

// ─────────────────────────────────────────────────── Toolbar trigger

const PRESET_LABELS: Array<{ mode: AiPresetMode; label: string; group?: "tone" }> = [
  { mode: "rephrase", label: "Rephrase" },
  { mode: "shorten", label: "Shorten" },
  { mode: "extend", label: "Extend" },
  { mode: "fix-grammar", label: "Fix grammar & spelling" },
  { mode: "summarize", label: "Summarize" },
  { mode: "tldr", label: "TL;DR" },
  { mode: "tone-formal", label: "More formal", group: "tone" },
  { mode: "tone-casual", label: "More casual", group: "tone" },
];

interface AiToolbarItemProps {
  baseUrl?: string;
}

function AiToolbarItem({ baseUrl }: AiToolbarItemProps) {
  const ai = useAi({ baseUrl: baseUrl ?? DEFAULT_BASE_URL });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // Close the popover on any non-idle state so the editor surface and
  // floating actions panel are unobstructed.
  useEffect(() => {
    if (ai.status !== "idle") setOpen(false);
  }, [ai.status]);

  return (
    <RadixPopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft("");
      }}
    >
      <RadixPopover.Trigger asChild>
        <MenuItem
          active={ai.isStreaming || ai.isDone}
          tooltip="Ask AI"
          shortcut="⌘J"
        >
          <Sparkle size={18} weight="bold" />
        </MenuItem>
      </RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content
          className="pp-popover pp-ai-popover"
          side="bottom"
          align="start"
          sideOffset={6}
        >
          <form
            className="pp-ai-form"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (!text) return;
              void ai.prompt(text);
              setDraft("");
            }}
          >
            <input
              type="text"
              className="pp-ai-input"
              placeholder="Ask the AI to write or rewrite…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              className="pp-popover-btn pp-popover-btn-primary"
              disabled={!draft.trim()}
            >
              Ask
            </button>
          </form>
          <div className="pp-ai-presets">
            <div className="pp-ai-section-label">Quick actions</div>
            {PRESET_LABELS.filter((p) => p.group !== "tone").map((preset) => (
              <button
                key={preset.mode}
                type="button"
                className="pp-ai-preset"
                onClick={() => {
                  void ai.transform(preset.mode);
                }}
              >
                {preset.label}
              </button>
            ))}
            <div className="pp-ai-section-label">Tone</div>
            {PRESET_LABELS.filter((p) => p.group === "tone").map((preset) => (
              <button
                key={preset.mode}
                type="button"
                className="pp-ai-preset"
                onClick={() => {
                  void ai.transform(preset.mode);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}

// ─────────────────────────────────────────────────── Preview action panel

/**
 * Floating panel anchored to the streamed range — shows during/after
 * a stream and exposes Accept / Reject / Regenerate. Render alongside
 * `<editor.Editor>` like the other companion popovers.
 */
export function AiPreviewActions({ baseUrl }: { baseUrl?: string } = {}) {
  const ai = useAi({ baseUrl });
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);

  useEditorEffect(
    (view) => {
      const range = ai.state.streamRange;
      if (!range) {
        setCoords(null);
        return;
      }
      const anchorPos = Math.min(range.to, view.state.doc.content.size);
      const dom = view.coordsAtPos(anchorPos);
      setCoords({ left: dom.left, top: dom.bottom + 8 });
    },
    [ai.state.streamRange?.from, ai.state.streamRange?.to, ai.status],
  );

  if (ai.status === "idle") return null;
  if (!coords) return null;

  return createPortal(
    <div
      className="pp-ai-actions"
      style={{ position: "fixed", left: coords.left, top: coords.top }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {ai.isStreaming && (
        <>
          <span className="pp-ai-status">
            <span className="pp-ai-spinner" aria-hidden="true" />
            Generating…
          </span>
          <button
            type="button"
            className="pp-ai-action pp-ai-action-cancel"
            onClick={ai.cancel}
            title="Cancel"
          >
            <Stop size={14} weight="bold" />
            Cancel
          </button>
        </>
      )}
      {ai.isDone && (
        <>
          <button
            type="button"
            className="pp-ai-action pp-ai-action-accept"
            onClick={ai.accept}
            title="Accept (replace original)"
          >
            <Check size={14} weight="bold" />
            Accept
          </button>
          <button
            type="button"
            className="pp-ai-action"
            onClick={() => void ai.regenerate()}
            title="Regenerate"
          >
            <ArrowClockwise size={14} weight="bold" />
            Regenerate
          </button>
          <button
            type="button"
            className="pp-ai-action pp-ai-action-reject"
            onClick={ai.reject}
            title="Reject"
          >
            <X size={14} weight="bold" />
            Reject
          </button>
        </>
      )}
      {ai.hasError && (
        <>
          <span className="pp-ai-status pp-ai-status-error">
            {ai.state.error ?? "Failed"}
          </span>
          <button
            type="button"
            className="pp-ai-action"
            onClick={() => void ai.regenerate()}
            title="Try again"
          >
            <ArrowClockwise size={14} weight="bold" />
            Retry
          </button>
          <button
            type="button"
            className="pp-ai-action pp-ai-action-reject"
            onClick={ai.reject}
            title="Dismiss"
          >
            <X size={14} weight="bold" />
            Dismiss
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

// ─────────────────────────────────────────────────── Extension factory

export function createAi(options: AiOptions = {}) {
  return Extension.create({
    name: "ai",
    plugins: () => [aiPlugin()],
    keymap: {
      // No mapped command keys yet — users wire ⌘J via their toolbar.
    },
    toolbar: () => <AiToolbarItem baseUrl={options.baseUrl} />,
    meta: { label: "Ask AI", group: "system", Icon: Sparkle },
  });
}

export const Ai = createAi();
