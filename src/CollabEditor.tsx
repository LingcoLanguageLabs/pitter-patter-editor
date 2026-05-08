/**
 * Multi-tab collaborative editor wired to the dev-server. Mounts the
 * `collab` / `comments` / `presence` plugins from
 * `@pitter-patter/{collab,comments,presence}-client` against the
 * dev-server's `/api/docs/:docId/...` routes (long-poll, in-process
 * broadcasters, in-memory storage).
 *
 * Open this story in two browser tabs against the same `?doc=` query
 * to see real-time edits + cursors. Add comments via the bubble menu;
 * the version history sidebar populates as snapshots are taken.
 */

import {
  ProseMirror,
  ProseMirrorDoc,
  reactKeys,
  useEditorEffect,
} from "@handlewithcare/react-prosemirror";
import { ChatCircle, Check, X as XIcon } from "@phosphor-icons/react";
import {
  CollabClient,
  LongPollListener as CollabListener,
  collab,
  receiveCommitTransaction,
  type CollabClientConfig,
} from "@pitter-patter/collab-client";
import {
  comment as commentMarkSpec,
  comments,
  createCommentThreadMark,
  removeCommentThreadMarks,
} from "@pitter-patter/comments-client";
import {
  LongPollListener as PresenceListener,
  PresenceClient,
  presence,
  receivePresenceTransaction,
  type PresenceClientConfig,
} from "@pitter-patter/presence-client";
import { randomRef } from "@pitter-patter/refs";
import {
  VersionHistoryClient,
  type Snapshot,
  type VersionHistoryClientConfig,
} from "@pitter-patter/version-history-client";
import "@pitter-patter/presence-client/styles.css";
import { baseKeymap } from "prosemirror-commands";
import { keymap } from "prosemirror-keymap";
import { Node, Schema } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import {
  EditorState,
  TextSelection,
  type Transaction,
} from "prosemirror-state";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const DEFAULT_BACKEND = "http://localhost:3001";

// Schema = basic + the comment mark (non-exclusive, non-inclusive,
// excludes:"" lets multiple comments coexist on the same range).
const collabSchema = new Schema({
  nodes: basicSchema.spec.nodes,
  marks: basicSchema.spec.marks.addToEnd("comment", commentMarkSpec),
});

// Random userId per browser tab — good enough for a demo. In a real
// product this'd come from auth.
const userId = `user-${randomRef().slice(0, 6)}`;

interface CommentThread {
  id: string;
  docId: string;
  range: { from: number; to: number };
  comments: Array<{
    id: string;
    threadId: string;
    authorId: string;
    authorName: string;
    body: string;
    createdAt: number;
  }>;
  resolved: boolean;
  createdAt: number;
}

interface CollabEditorProps {
  docId?: string;
  backend?: string;
}

export function CollabEditor({
  docId = "demo",
  backend = DEFAULT_BACKEND,
}: CollabEditorProps) {
  const [state, setState] = useState(() =>
    EditorState.create({
      doc: collabSchema.nodes["doc"]!.createAndFill()!,
      schema: collabSchema,
      plugins: [
        collab({ version: 0 }),
        presence(),
        comments({ commentMarkType: collabSchema.marks["comment"]! }),
        keymap(baseKeymap),
        reactKeys(),
      ],
    }),
  );
  const [initialState] = useState(state);

  // ─── Long-poll listeners ────────────────────────────────

  const collabListener = useMemo(
    () => new CollabListener(new URL(`${backend}/api/docs/${docId}/commits`)),
    [backend, docId],
  );

  const presenceListener = useMemo(
    () => new PresenceListener(new URL(`${backend}/api/docs/${docId}/presence`)),
    [backend, docId],
  );

  // ─── Clients ────────────────────────────────────────────

  const collabConfig = useMemo<CollabClientConfig>(
    () => ({
      sendCommit: async (commit) => {
        await fetch(`${backend}/api/docs/${docId}/commits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(commit.toJSON()),
        });
      },
      getCommits: collabListener.getCommits.bind(collabListener),
      receiveCommits: (commits) => {
        setState((prev) =>
          commits.reduce(
            (acc, c) => acc.apply(receiveCommitTransaction(acc, c)),
            prev,
          ),
        );
      },
    }),
    [backend, docId, collabListener],
  );

  const presenceConfig = useMemo<PresenceClientConfig>(
    () => ({
      userId,
      sendIndicator: async (clientId, indicator) => {
        await fetch(`${backend}/api/docs/${docId}/presence/${clientId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(indicator),
        });
      },
      getIndicators: presenceListener.getIndicators.bind(presenceListener),
      receiveIndicators: (indicators) => {
        setState((prev) => prev.apply(receivePresenceTransaction(prev, indicators)));
      },
    }),
    [backend, docId, presenceListener],
  );

  const versionHistoryConfig = useMemo<VersionHistoryClientConfig>(
    () => ({
      getSnapshots: async (afterVersion) => {
        const url = new URL(`${backend}/api/docs/${docId}/snapshots`);
        if (afterVersion !== undefined) {
          url.searchParams.set("version", afterVersion.toString());
        }
        const response = await fetch(url);
        return (await response.json()) as Snapshot[];
      },
      receiveSnapshots: () => {},
      pollDuration: 5_000,
    }),
    [backend, docId],
  );

  const [collabClient] = useState(() => new CollabClient(collabConfig));
  const [presenceClient] = useState(() => new PresenceClient(presenceConfig));

  // Snapshots — using the client's poll loop AND a setState reducer
  // so the sidebar updates without depending on the client's
  // receiveSnapshots callback (which is consumer-defined).
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [versionHistoryClient] = useState(
    () =>
      new VersionHistoryClient({
        ...versionHistoryConfig,
        receiveSnapshots: (next) => {
          setSnapshots((prev) => {
            const ids = new Set(prev.map((s) => s.snapshotId));
            const merged = [...prev];
            for (const s of next) {
              if (!ids.has(s.snapshotId)) merged.push(s);
            }
            merged.sort((a, b) => a.version - b.version);
            return merged;
          });
        },
      }),
  );

  // ─── Effects ────────────────────────────────────────────

  const dispatchTransaction = useCallback((tr: Transaction) => {
    setState((prev) => prev.apply(tr));
  }, []);

  useEffect(() => {
    collabClient.send(state).catch(console.error);
  }, [collabClient, state]);

  useEffect(() => {
    presenceClient.send(state).catch(console.error);
  }, [presenceClient, state]);

  useEffect(() => {
    const ac = new AbortController();
    collabClient.listen(initialState, ac.signal).catch(console.error);
    return () => ac.abort();
  }, [collabClient, initialState]);

  useEffect(() => {
    const ac = new AbortController();
    presenceClient.listen(ac.signal).catch(console.error);
    return () => ac.abort();
  }, [presenceClient]);

  useEffect(() => {
    const ac = new AbortController();
    versionHistoryClient.poll(ac.signal).catch(console.error);
    return () => ac.abort();
  }, [versionHistoryClient]);

  // ─── Comments ──────────────────────────────────────────

  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [composerThreadId, setComposerThreadId] = useState<string | null>(null);
  const [composerRange, setComposerRange] = useState<{ from: number; to: number } | null>(null);

  const refreshThreads = useCallback(async () => {
    const response = await fetch(`${backend}/api/docs/${docId}/comments/threads`);
    if (!response.ok) return;
    setThreads((await response.json()) as CommentThread[]);
  }, [backend, docId]);

  useEffect(() => {
    void refreshThreads();
    const id = window.setInterval(refreshThreads, 5_000);
    return () => window.clearInterval(id);
  }, [refreshThreads]);

  const createThread = useCallback(
    async (range: { from: number; to: number }, body: string) => {
      const id = `thread-${randomRef().slice(0, 8)}`;
      const response = await fetch(`${backend}/api/docs/${docId}/comments/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          range,
          initial: { authorId: userId, authorName: userId, body },
        }),
      });
      if (!response.ok) return;
      // Apply the mark to the selected range.
      const markType = collabSchema.marks["comment"]!;
      const cmd = createCommentThreadMark(markType, id);
      cmd(state, dispatchTransaction);
      await refreshThreads();
    },
    [backend, docId, state, dispatchTransaction, refreshThreads],
  );

  const replyToThread = useCallback(
    async (threadId: string, body: string) => {
      await fetch(`${backend}/api/docs/${docId}/comments/threads/${threadId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId: userId, authorName: userId, body }),
      });
      await refreshThreads();
    },
    [backend, docId, refreshThreads],
  );

  const resolveThread = useCallback(
    async (threadId: string, resolved: boolean) => {
      await fetch(`${backend}/api/docs/${docId}/comments/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      await refreshThreads();
    },
    [backend, docId, refreshThreads],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      await fetch(`${backend}/api/docs/${docId}/comments/threads/${threadId}`, {
        method: "DELETE",
      });
      // Also strip the mark from the doc.
      const markType = collabSchema.marks["comment"]!;
      const cmd = removeCommentThreadMarks(markType, threadId);
      cmd(state, dispatchTransaction);
      await refreshThreads();
    },
    [backend, docId, state, dispatchTransaction, refreshThreads],
  );

  const focusThreadRange = useCallback(
    (range: { from: number; to: number }) => {
      setState((prev) => {
        const safeFrom = Math.min(range.from, prev.doc.content.size);
        const safeTo = Math.min(range.to, prev.doc.content.size);
        return prev.apply(
          prev.tr.setSelection(TextSelection.create(prev.doc, safeFrom, safeTo)).scrollIntoView(),
        );
      });
    },
    [],
  );

  const onAddCommentClick = useCallback(() => {
    if (state.selection.empty) return;
    setComposerRange({ from: state.selection.from, to: state.selection.to });
    setComposerThreadId(null);
  }, [state.selection]);

  return (
    <div className="collab-editor">
      <div className="collab-editor__main">
        <div className="collab-editor__toolbar">
          <span className="collab-editor__doc-label">
            doc:&nbsp;<code>{docId}</code>
          </span>
          <span className="collab-editor__user-label">
            you:&nbsp;<code>{userId}</code>
          </span>
          <span className="collab-editor__spacer" />
          <button
            type="button"
            className="collab-editor__btn"
            disabled={state.selection.empty}
            onClick={onAddCommentClick}
          >
            <ChatCircle size={14} weight="bold" />
            Add comment
          </button>
        </div>
        <div className="collab-editor__doc">
          <ProseMirror state={state} dispatchTransaction={dispatchTransaction}>
            <ProseMirrorDoc />
          </ProseMirror>
          {composerRange && (
            <CommentComposer
              range={composerRange}
              onSubmit={async (body) => {
                await createThread(composerRange, body);
                setComposerRange(null);
              }}
              onCancel={() => setComposerRange(null)}
            />
          )}
        </div>
      </div>
      <aside className="collab-editor__sidebar">
        <CommentsSidebar
          threads={threads}
          activeThreadId={composerThreadId}
          onActivate={(t) => {
            setComposerThreadId(t.id);
            focusThreadRange(t.range);
          }}
          onReply={replyToThread}
          onResolve={(id) => resolveThread(id, true)}
          onUnresolve={(id) => resolveThread(id, false)}
          onDelete={deleteThread}
        />
        <VersionHistorySidebar
          snapshots={snapshots}
          onRestore={(snap) => {
            const restored = Node.fromJSON(collabSchema, snap.snapshotJSON);
            // Replace current doc with snapshot. This is a destructive
            // local restore — it dispatches a regular tr that gets sent
            // as a commit through the collab plugin.
            const tr = state.tr;
            tr.replaceWith(0, state.doc.content.size, restored.content);
            dispatchTransaction(tr);
          }}
        />
      </aside>
    </div>
  );
}

// ─────────────────────────────────────────────────── Composer

interface CommentComposerProps {
  range: { from: number; to: number };
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

function CommentComposer({ onSubmit, onCancel }: CommentComposerProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="comment-composer">
      <textarea
        ref={inputRef}
        className="comment-composer__input"
        rows={3}
        placeholder="Comment on the selection…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (draft.trim()) onSubmit(draft.trim());
          }
        }}
      />
      <div className="comment-composer__actions">
        <button type="button" className="comment-composer__btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="comment-composer__btn comment-composer__btn--primary"
          disabled={!draft.trim()}
          onClick={() => onSubmit(draft.trim())}
        >
          Comment
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────── Comments sidebar

interface CommentsSidebarProps {
  threads: CommentThread[];
  activeThreadId: string | null;
  onActivate: (t: CommentThread) => void;
  onReply: (threadId: string, body: string) => Promise<void>;
  onResolve: (threadId: string) => Promise<void>;
  onUnresolve: (threadId: string) => Promise<void>;
  onDelete: (threadId: string) => Promise<void>;
}

function CommentsSidebar({
  threads,
  activeThreadId,
  onActivate,
  onReply,
  onResolve,
  onUnresolve,
  onDelete,
}: CommentsSidebarProps) {
  return (
    <section className="collab-sidebar">
      <h3 className="collab-sidebar__title">Comments</h3>
      {threads.length === 0 && (
        <p className="collab-sidebar__empty">
          Select text and click <em>Add comment</em>.
        </p>
      )}
      <ul className="collab-sidebar__list">
        {threads.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            active={activeThreadId === thread.id}
            onActivate={() => onActivate(thread)}
            onReply={(body) => onReply(thread.id, body)}
            onResolve={() => onResolve(thread.id)}
            onUnresolve={() => onUnresolve(thread.id)}
            onDelete={() => onDelete(thread.id)}
          />
        ))}
      </ul>
    </section>
  );
}

interface ThreadCardProps {
  thread: CommentThread;
  active: boolean;
  onActivate: () => void;
  onReply: (body: string) => Promise<void>;
  onResolve: () => Promise<void>;
  onUnresolve: () => Promise<void>;
  onDelete: () => Promise<void>;
}

function ThreadCard({
  thread,
  active,
  onActivate,
  onReply,
  onResolve,
  onUnresolve,
  onDelete,
}: ThreadCardProps) {
  const [draft, setDraft] = useState("");
  return (
    <li
      className={`thread-card${active ? " thread-card--active" : ""}${thread.resolved ? " thread-card--resolved" : ""}`}
      onClick={onActivate}
    >
      <header className="thread-card__header">
        <span className="thread-card__author">{thread.comments[0]?.authorName}</span>
        <span className="thread-card__time">
          {new Date(thread.createdAt).toLocaleTimeString()}
        </span>
        <span className="thread-card__spacer" />
        <button
          type="button"
          className="thread-card__icon-btn"
          title={thread.resolved ? "Reopen" : "Resolve"}
          onClick={(e) => {
            e.stopPropagation();
            void (thread.resolved ? onUnresolve() : onResolve());
          }}
        >
          <Check size={12} weight="bold" />
        </button>
        <button
          type="button"
          className="thread-card__icon-btn"
          title="Delete thread"
          onClick={(e) => {
            e.stopPropagation();
            void onDelete();
          }}
        >
          <XIcon size={12} weight="bold" />
        </button>
      </header>
      {thread.comments.map((c) => (
        <div key={c.id} className="thread-card__comment">
          <span className="thread-card__author-inline">{c.authorName}:</span>
          <span className="thread-card__body">{c.body}</span>
        </div>
      ))}
      {!thread.resolved && (
        <form
          className="thread-card__reply"
          onClick={(e) => e.stopPropagation()}
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = draft.trim();
            if (!trimmed) return;
            void onReply(trimmed);
            setDraft("");
          }}
        >
          <input
            type="text"
            className="thread-card__reply-input"
            placeholder="Reply…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            type="submit"
            className="thread-card__reply-btn"
            disabled={!draft.trim()}
          >
            Reply
          </button>
        </form>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────── Version history sidebar

interface VersionHistorySidebarProps {
  snapshots: Snapshot[];
  onRestore: (snap: Snapshot) => void;
}

function VersionHistorySidebar({ snapshots, onRestore }: VersionHistorySidebarProps) {
  return (
    <section className="collab-sidebar">
      <h3 className="collab-sidebar__title">Version history</h3>
      {snapshots.length === 0 && (
        <p className="collab-sidebar__empty">Snapshots appear as you type.</p>
      )}
      <ul className="collab-sidebar__list">
        {snapshots
          .slice()
          .reverse()
          .map((snap) => (
            <li key={snap.snapshotId} className="snapshot-card">
              <header className="snapshot-card__header">
                <span className="snapshot-card__version">v{snap.version}</span>
                <span className="snapshot-card__time">
                  {new Date(snap.createdAt).toLocaleTimeString()}
                </span>
                <span className="snapshot-card__spacer" />
                <button
                  type="button"
                  className="snapshot-card__btn"
                  onClick={() => onRestore(snap)}
                  title="Restore this version"
                >
                  Restore
                </button>
              </header>
            </li>
          ))}
      </ul>
    </section>
  );
}

// Suppress an unused-import warning while keeping useEditorEffect
// available for future enhancements (e.g. scrolling threads into view).
void useEditorEffect;
