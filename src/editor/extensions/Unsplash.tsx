import { ImageSquare } from "@phosphor-icons/react";
import {
  useEditorEffect,
  useEditorEventCallback,
  useEditorState,
} from "@handlewithcare/react-prosemirror";
import { Plugin, PluginKey, type Command } from "prosemirror-state";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

import { MenuItem } from "../menu/MenuItem";
import { Extension } from "../types";

// ────────────────────────────────────────────────────────────── Types

export interface UnsplashPhoto {
  id: string;
  urls: {
    thumb?: string;
    small?: string;
    regular?: string;
    full?: string;
  };
  description: string | null;
  alt_description: string | null;
  user: {
    name: string;
    links: { html: string };
  };
  links: { html: string };
}

interface UnsplashState {
  open: boolean;
  /** Doc position to insert the picked image at. Captured at open time. */
  insertAt: number | null;
}

export const unsplashPluginKey = new PluginKey<UnsplashState>("pp-unsplash");

const INITIAL_STATE: UnsplashState = { open: false, insertAt: null };

interface UnsplashMeta {
  type: "open" | "close";
  insertAt?: number;
}

export interface UnsplashOptions {
  /** Backend URL — proxies the Unsplash API. */
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "http://localhost:3001/api/unsplash";

// ────────────────────────────────────────────────────────────── Plugin

function unsplashPlugin(): Plugin<UnsplashState> {
  return new Plugin<UnsplashState>({
    key: unsplashPluginKey,
    state: {
      init: () => INITIAL_STATE,
      apply(tr, prev) {
        const meta = tr.getMeta(unsplashPluginKey) as UnsplashMeta | undefined;
        if (!meta) {
          return prev.insertAt != null
            ? { ...prev, insertAt: tr.mapping.map(prev.insertAt) }
            : prev;
        }
        if (meta.type === "open") {
          return { open: true, insertAt: meta.insertAt ?? null };
        }
        if (meta.type === "close") {
          return INITIAL_STATE;
        }
        return prev;
      },
    },
  });
}

// ────────────────────────────────────────────────────────────── Commands

export function unsplashOpen(): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    dispatch(
      state.tr.setMeta(unsplashPluginKey, {
        type: "open",
        insertAt: state.selection.from,
      } satisfies UnsplashMeta),
    );
    return true;
  };
}

export function unsplashClose(): Command {
  return (state, dispatch) => {
    if (!dispatch) return true;
    dispatch(
      state.tr.setMeta(unsplashPluginKey, { type: "close" } satisfies UnsplashMeta),
    );
    return true;
  };
}

// ────────────────────────────────────────────────────────────── Hook

export interface UseUnsplashResult {
  open: boolean;
  insertAt: number | null;
  search: (query: string, page?: number) => Promise<UnsplashPhoto[]>;
  random: (count?: number) => Promise<UnsplashPhoto[]>;
  insert: (photo: UnsplashPhoto) => void;
  openPicker: () => void;
  closePicker: () => void;
}

export function useUnsplash(options: UnsplashOptions = {}): UseUnsplashResult {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const editorState = useEditorState();
  const ui = editorState
    ? (unsplashPluginKey.getState(editorState) ?? INITIAL_STATE)
    : INITIAL_STATE;

  const search = useCallback(
    async (query: string, page = 1): Promise<UnsplashPhoto[]> => {
      const url = new URL(`${baseUrl}/search`);
      url.searchParams.set("q", query);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", "12");
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { results: UnsplashPhoto[] };
      return data.results ?? [];
    },
    [baseUrl],
  );

  const random = useCallback(
    async (count = 12): Promise<UnsplashPhoto[]> => {
      const url = new URL(`${baseUrl}/random`);
      url.searchParams.set("count", String(count));
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = (await res.json()) as { results: UnsplashPhoto[] };
      return data.results ?? [];
    },
    [baseUrl],
  );

  const insert = useEditorEventCallback((view, photo: UnsplashPhoto) => {
    if (!view) return;
    const imageType = view.state.schema.nodes["image"];
    if (!imageType) return;
    const liveAt = unsplashPluginKey.getState(view.state)?.insertAt ?? view.state.selection.from;
    const src = photo.urls.regular ?? photo.urls.full ?? photo.urls.small;
    if (!src) return;
    const alt =
      photo.alt_description ??
      photo.description ??
      `Photo by ${photo.user.name} on Unsplash`;
    const credit = `Photo by ${photo.user.name} on Unsplash — ${photo.user.links.html}`;
    const node = imageType.create({
      src,
      alt,
      title: credit,
      width: "75%",
      align: "center",
    });
    let tr = view.state.tr.insert(liveAt, node);
    tr.setMeta(unsplashPluginKey, { type: "close" } satisfies UnsplashMeta);
    view.dispatch(tr.scrollIntoView());
    view.focus();
  });

  const openPicker = useEditorEventCallback((view) => {
    if (!view) return;
    unsplashOpen()(view.state, view.dispatch);
  });

  const closePicker = useEditorEventCallback((view) => {
    if (!view) return;
    unsplashClose()(view.state, view.dispatch);
  });

  return {
    open: ui.open,
    insertAt: ui.insertAt,
    search,
    random,
    insert,
    openPicker,
    closePicker,
  };
}

// ────────────────────────────────────────────────────────────── Toolbar item

interface UnsplashToolbarItemProps {
  baseUrl?: string;
}

function UnsplashToolbarItem({ baseUrl }: UnsplashToolbarItemProps) {
  const u = useUnsplash({ baseUrl });
  return (
    <MenuItem onClick={u.openPicker} tooltip="Insert Unsplash photo" active={u.open}>
      <ImageSquare size={18} weight="bold" />
    </MenuItem>
  );
}

// ────────────────────────────────────────────────────────────── Picker

interface UnsplashPickerProps {
  baseUrl?: string;
}

/**
 * Floating picker panel, triggered via the toolbar button or slash
 * menu. Renders only when the plugin's `open` flag is true. Search
 * input + thumbnail grid; click a thumb to insert.
 */
export function UnsplashPicker({ baseUrl }: UnsplashPickerProps = {}) {
  const u = useUnsplash({ baseUrl });
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Focus search input when opened.
  useEffect(() => {
    if (!u.open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [u.open]);

  // Initial random photos when first opened.
  useEffect(() => {
    if (!u.open) return;
    if (photos.length > 0) return;
    setLoading(true);
    u.random(12)
      .then((results) => {
        setPhotos(results);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u.open]);

  // Debounced search as the user types.
  useEffect(() => {
    if (!u.open) return;
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const q = query.trim();
      if (!q) return;
      setLoading(true);
      u.search(q)
        .then((results) => {
          setPhotos(results);
          setError(null);
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, u.open]);

  // Reset state when closed.
  useEffect(() => {
    if (u.open) return;
    setQuery("");
    setPhotos([]);
    setError(null);
  }, [u.open]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        u.closePicker();
      }
    },
    [u],
  );

  if (!u.open) return null;

  return createPortal(
    <div className="pp-unsplash-backdrop" onClick={u.closePicker}>
      <div
        className="pp-unsplash-panel"
        role="dialog"
        aria-label="Insert from Unsplash"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="pp-unsplash-header">
          <input
            ref={inputRef}
            type="text"
            className="pp-unsplash-search"
            placeholder="Search Unsplash photos…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="pp-unsplash-close"
            onClick={u.closePicker}
            aria-label="Close"
          >
            ✕
          </button>
        </header>
        <div className="pp-unsplash-body">
          {error && <div className="pp-unsplash-error">{error}</div>}
          {!error && loading && photos.length === 0 && (
            <div className="pp-unsplash-empty">Loading…</div>
          )}
          {!error && !loading && photos.length === 0 && (
            <div className="pp-unsplash-empty">No results. Try a different search.</div>
          )}
          {photos.length > 0 && (
            <div className="pp-unsplash-grid">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className="pp-unsplash-thumb"
                  onClick={() => u.insert(photo)}
                  title={photo.alt_description ?? photo.description ?? ""}
                >
                  <img
                    src={photo.urls.thumb ?? photo.urls.small ?? ""}
                    alt={photo.alt_description ?? ""}
                    loading="lazy"
                  />
                  <span className="pp-unsplash-credit">
                    Photo by{" "}
                    <a
                      href={`${photo.user.links.html}?utm_source=pitter-patter&utm_medium=referral`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {photo.user.name}
                    </a>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <footer className="pp-unsplash-footer">
          Photos via{" "}
          <a
            href="https://unsplash.com/?utm_source=pitter-patter&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
          >
            Unsplash
          </a>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// ────────────────────────────────────────────────────────────── Extension

export function createUnsplash(options: UnsplashOptions = {}) {
  return Extension.create({
    name: "unsplash",
    plugins: () => [unsplashPlugin()],
    toolbar: () => <UnsplashToolbarItem baseUrl={options.baseUrl} />,
    meta: { label: "Unsplash", group: "block", Icon: ImageSquare },
  });
}

export const Unsplash = createUnsplash();

// Suppress an unused-import warning while keeping the hook public.
void useEditorEffect;
