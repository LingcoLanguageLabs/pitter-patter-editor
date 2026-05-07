import {
  ArrowClockwise,
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
import { Slice } from "prosemirror-model";
import {
  Plugin,
  PluginKey,
  type Command,
  type EditorState,
} from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { Decoration, DecorationSet } from "prosemirror-view";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

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
  /**
   * Monotonically-incrementing tick. Bumped by `aiOpenDock` so the
   * `<AiDock />` component's effect can react and focus its textarea
   * even when the dock was already expanded.
   */
  focusTick: number;
  /**
   * Selection range remembered when the dock was opened. The dock
   * loses selection focus when the textarea takes it, so we stash the
   * range here and read it back when the user submits a preset mode.
   * Mapped forward across edits.
   */
  dockSelection: { from: number; to: number } | null;
}

export interface AiExample {
  /** Stable id for the example. */
  value: string;
  /** Label shown in the popover. */
  label: string;
  /** Optional icon component (Phosphor or any SVG-emitting component). */
  icon?: React.ComponentType<{ size?: number; weight?: "regular" | "bold" }>;
  /** Search keywords for typeahead filtering. */
  keywords?: string[];
  /** Hard-coded prompt sent as the user instruction. Ignored if `mode` is set. */
  prompt?: string;
  /** Preset mode — uses the server-side preset system prompt. */
  mode?: AiPresetMode;
  /** Optional language hint for translate-mode examples. */
  language?: string;
}

export interface AiOptions {
  /** Backend URL. Defaults to the local dev-server. */
  baseUrl?: string;
  /**
   * Examples surfaced in the popover above the dock. When omitted,
   * the editor's default presets are used (Rephrase / Shorten / etc.).
   */
  examples?: AiExample[];
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
    | "reset"
    | "open-dock"
    | "close-dock";
  replacedSlice?: Slice | null;
  sourceText?: string;
  streamPos?: number;
  message?: string;
  generatedWith?: AiState["generatedWith"];
  selection?: { from: number; to: number } | null;
}

const INITIAL_STATE: AiState = {
  status: "idle",
  replacedSlice: null,
  sourceText: "",
  streamRange: null,
  generatedWith: null,
  error: null,
  focusTick: 0,
  dockSelection: null,
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
        // Map streamRange + dockSelection forward across every
        // transaction so they track edits.
        const mapStream = prev.streamRange
          ? {
              from: tr.mapping.map(prev.streamRange.from, -1),
              to: tr.mapping.map(prev.streamRange.to, 1),
            }
          : null;
        const mapDockSelection = prev.dockSelection
          ? {
              from: tr.mapping.map(prev.dockSelection.from, -1),
              to: tr.mapping.map(prev.dockSelection.to, 1),
            }
          : null;
        const next: AiState = {
          ...prev,
          streamRange: mapStream,
          dockSelection: mapDockSelection,
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
              focusTick: next.focusTick,
              dockSelection: next.dockSelection,
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
    // Prefer the live PM selection; if the dock has the focus, the live
    // selection is empty so fall back to the dockSelection we stashed
    // when the dock opened.
    const ai = aiPluginKey.getState(view.state);
    const liveSelection = view.state.selection.empty
      ? null
      : { from: view.state.selection.from, to: view.state.selection.to };
    const range = liveSelection ?? ai?.dockSelection ?? null;

    if (range && range.to > range.from) {
      replacedSlice = view.state.doc.slice(range.from, range.to);
      sourceText = view.state.doc.textBetween(
        range.from,
        range.to,
        "\n",
        "\n",
      );
      streamPos = range.from;
      view.dispatch(view.state.tr.delete(range.from, range.to));
    } else {
      // Empty cursor — generate at the caret with no source content.
      streamPos = view.state.selection.from;
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
 * Open (and focus) the persistent AI dock. Captures the current
 * non-empty selection so preset modes can still operate on it after
 * focus shifts to the dock textarea.
 */
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
    const ai = aiPluginKey.getState(state);
    if (!ai || ai.dockSelection == null) return false;
    if (!dispatch) return true;
    dispatch(
      state.tr.setMeta(aiPluginKey, {
        type: "close-dock",
      } satisfies AiMeta),
    );
    return true;
  };
}

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
  /** Open and focus the AI dock, stashing the current selection. */
  openDock: () => void;
  /** Close the dock without running a request. */
  closeDock: () => void;
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

  const openDock = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiOpenDock()(view.state, view.dispatch);
  });

  const closeDock = useEditorEventCallback((view: EditorView | null) => {
    if (!view) return;
    aiCloseDock()(view.state, view.dispatch);
  });

  return {
    state: ai,
    status: ai.status,
    isStreaming: ai.status === "streaming",
    isDone: ai.status === "done",
    hasError: ai.status === "error",
    prompt: (instruction) => start({ instruction }),
    transform: (mode, opts) => start({ mode, language: opts?.language }),
    openDock,
    closeDock,
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

interface AiToolbarItemProps {
  baseUrl?: string;
}

/**
 * The toolbar Sparkle button. Click → opens (and focuses) the
 * persistent `<AiDock />`. Active styling reflects the in-flight stream.
 */
function AiToolbarItem({ baseUrl }: AiToolbarItemProps) {
  const ai = useAi({ baseUrl: baseUrl ?? DEFAULT_BASE_URL });
  return (
    <MenuItem
      active={ai.isStreaming || ai.isDone}
      onClick={ai.openDock}
      tooltip="Ask AI"
      shortcut="⌘J"
    >
      <Sparkle size={18} weight="bold" />
    </MenuItem>
  );
}

// ─────────────────────────────────────────────────── AI dock

const DEFAULT_EXAMPLES: AiExample[] = [
  { value: "rephrase", label: "Rephrase", mode: "rephrase", icon: PencilSimple, keywords: ["reword", "paraphrase"] },
  { value: "shorten", label: "Shorten", mode: "shorten", icon: Subtract, keywords: ["trim", "tighten"] },
  { value: "extend", label: "Extend", mode: "extend", icon: Plus, keywords: ["expand", "lengthen"] },
  { value: "fix-grammar", label: "Fix grammar & spelling", mode: "fix-grammar", icon: MagnifyingGlass, keywords: ["proofread", "grammar", "spelling"] },
  { value: "summarize", label: "Summarize", mode: "summarize", icon: ListBullets, keywords: ["summary"] },
  { value: "tldr", label: "TL;DR", mode: "tldr", icon: TextAa, keywords: ["tldr", "tl;dr"] },
];

interface AiDockProps {
  /** Override the backend URL. */
  baseUrl?: string;
  /** Custom example list. Defaults to the editor's preset modes. */
  examples?: AiExample[];
}

/**
 * Persistent bottom dock. Three states:
 *   collapsed — small pill with sparkle + placeholder text
 *   focused   — textarea + submit + examples popover above
 *   processing — spinner + thinking text + stop button
 *
 * Render alongside `<editor.Editor>` like the other companion popovers.
 */
export function AiDock({ baseUrl, examples }: AiDockProps = {}) {
  const ai = useAi({ baseUrl, examples });
  const items = examples ?? DEFAULT_EXAMPLES;

  const [collapsed, setCollapsed] = useState(true);
  const [draft, setDraft] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusTick = ai.state.focusTick;

  // External focus requests (toolbar click, slash menu, bubble menu) bump
  // focusTick — react by expanding and focusing the textarea.
  useEffect(() => {
    if (focusTick === 0) return;
    setCollapsed(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [focusTick]);

  // Auto-grow the textarea up to a maxRows-equivalent height.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [draft, collapsed]);

  // Collapse when focus leaves the dock and the textarea is empty.
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

  // Auto-collapse on stream start so the actions panel is unobstructed.
  useEffect(() => {
    if (ai.isStreaming || ai.isDone) {
      setCollapsed(true);
      setDraft("");
    }
  }, [ai.isStreaming, ai.isDone]);

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
      if (example.mode) {
        void ai.transform(example.mode, { language: example.language });
      } else if (example.prompt) {
        void ai.prompt(example.prompt);
      }
    },
    [ai],
  );

  // Processing branch.
  if (ai.isStreaming) {
    return createPortal(
      <div className="pp-ai-dock-floating" data-position="bottom">
        <div className="pp-ai-dock pp-ai-dock-processing">
          <div className="pp-ai-spinner-dots" aria-hidden="true">
            <span /><span /><span />
          </div>
          <span className="pp-ai-dock-status">AI is thinking…</span>
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

  // Collapsed pill.
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
          <span className="pp-ai-dock-btn pp-ai-dock-btn-primary pp-ai-dock-btn-disabled" aria-hidden="true">
            <ArrowUp size={14} weight="bold" />
          </span>
        </button>
      </div>,
      document.body,
    );
  }

  // Focused / expanded.
  const filteredItems = filterExamples(items, draft);
  const showExamples = filteredItems.length > 0;

  return createPortal(
    <div className="pp-ai-dock-floating" data-position="bottom">
      {showExamples && (
        <div className="pp-ai-dock-examples" role="listbox" aria-label="AI Toolkit examples">
          <div className="pp-ai-dock-examples-label">AI Toolkit examples</div>
          {filteredItems.map((item) => (
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

function filterExamples(items: AiExample[], query: string): AiExample[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    if (item.label.toLowerCase().includes(q)) return true;
    if (item.value.includes(q)) return true;
    return item.keywords?.some((k) => k.toLowerCase().includes(q)) ?? false;
  });
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
