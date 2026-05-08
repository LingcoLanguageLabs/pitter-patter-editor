/**
 * In-memory storage for the dev-server's collab/comments/snapshots
 * surface. Keyed by docId. No persistence — restart loses data.
 *
 * The shape mirrors what `@pitter-patter/collab-server`'s
 * `CollabAuthority` config callbacks expect, plus a simple comments
 * map (the upstream comments-server is incomplete, so we DIY).
 */

import type { CommitJSON, NodeJSON } from "@stepwisehq/prosemirror-collab-commit/collab-commit";

interface DocRecord {
  id: string;
  content: NodeJSON;
  version: number;
  lastUpdatedTimestamp: number;
}

interface CommitRecord {
  docId: string;
  ref: string;
  version: number;
  steps: { [key: string]: unknown }[];
}

interface SnapshotRecord {
  snapshotId: string;
  docId: string;
  version: number;
  content: NodeJSON;
  createdAt: number;
}

export interface CommentThread {
  id: string;
  docId: string;
  /**
   * Range the thread is anchored to. Stored at thread-creation time;
   * the editor's `comment` mark in the doc is what drives the live
   * highlighting. Useful for sidebar previews.
   */
  range: { from: number; to: number };
  comments: CommentEntry[];
  resolved: boolean;
  createdAt: number;
}

export interface CommentEntry {
  id: string;
  threadId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: number;
}

interface PresenceRecord {
  ref: string;
  clientId: string;
  userId: string;
  anchor: number;
  head: number;
  version: number;
  /** When the indicator was last touched — used to evict stale ones. */
  updatedAt: number;
}

const docs = new Map<string, DocRecord>();
const commits = new Map<string, CommitRecord[]>();
const snapshots = new Map<string, SnapshotRecord[]>();
const threads = new Map<string, CommentThread[]>();
const presence = new Map<string, Map<string, PresenceRecord>>();

const PRESENCE_TTL_MS = 30_000;

function pruneStalePresence(docId: string) {
  const map = presence.get(docId);
  if (!map) return;
  const now = Date.now();
  for (const [clientId, indicator] of map) {
    if (now - indicator.updatedAt > PRESENCE_TTL_MS) {
      map.delete(clientId);
    }
  }
}

// ─────────────────────────────────────────────────── Docs

export function getDoc(docId: string): DocRecord {
  let doc = docs.get(docId);
  if (!doc) {
    doc = {
      id: docId,
      content: emptyDocJSON(),
      version: 0,
      lastUpdatedTimestamp: Date.now(),
    };
    docs.set(docId, doc);
    // Seed snapshot 0 so version history isn't empty.
    appendSnapshot({
      snapshotId: `snap-${docId}-0`,
      docId,
      version: 0,
      content: doc.content,
      createdAt: Date.now(),
    });
  }
  return doc;
}

export function saveDoc(
  docId: string,
  content: NodeJSON,
  version: number,
  _lastUpdatedTimestamp: number,
): void {
  // Always stamp the current write time. The `lastUpdatedTimestamp`
  // parameter is the *previous* value (the version-history wrapper
  // passes it through so it can compute the time-since-last-update
  // gap before this save lands). If we wrote it back verbatim,
  // `lastUpdatedTimestamp` would never advance and snapshots would
  // fire on every commit.
  docs.set(docId, {
    id: docId,
    content,
    version,
    lastUpdatedTimestamp: Date.now(),
  });
}

export function ensureDoc(docId: string, initialContent: NodeJSON): void {
  if (docs.has(docId)) return;
  docs.set(docId, {
    id: docId,
    content: initialContent,
    version: 0,
    lastUpdatedTimestamp: Date.now(),
  });
  appendSnapshot({
    snapshotId: `snap-${docId}-0`,
    docId,
    version: 0,
    content: initialContent,
    createdAt: Date.now(),
  });
}

// ─────────────────────────────────────────────────── Commits

export function getCommitByRef(docId: string, ref: string): CommitJSON | null {
  const list = commits.get(docId) ?? [];
  const found = list.find((c) => c.ref === ref);
  if (!found) return null;
  return { ref: found.ref, version: found.version, steps: found.steps };
}

export function getCommitsAfter(
  docId: string,
  afterVersion: number,
): CommitJSON[] {
  const list = commits.get(docId) ?? [];
  return list
    .filter((c) => c.version > afterVersion)
    .map((c) => ({ ref: c.ref, version: c.version, steps: c.steps }));
}

export function appendCommit(
  docId: string,
  ref: string,
  version: number,
  steps: { [key: string]: unknown }[],
): void {
  const list = commits.get(docId) ?? [];
  list.push({ docId, ref, version, steps });
  commits.set(docId, list);
}

// ─────────────────────────────────────────────────── Snapshots

export function appendSnapshot(snapshot: SnapshotRecord): void {
  const list = snapshots.get(snapshot.docId) ?? [];
  list.push(snapshot);
  snapshots.set(snapshot.docId, list);
}

export function getLatestSnapshot(docId: string): SnapshotRecord | null {
  const list = snapshots.get(docId) ?? [];
  return list.length === 0 ? null : (list.at(-1) ?? null);
}

export function getSnapshots(
  docId: string,
  afterVersion?: number,
): SnapshotRecord[] {
  const list = snapshots.get(docId) ?? [];
  if (afterVersion === undefined) return list;
  return list.filter((s) => s.version > afterVersion);
}

// ─────────────────────────────────────────────────── Comments

export function listThreads(docId: string): CommentThread[] {
  return threads.get(docId) ?? [];
}

export function createThread(thread: CommentThread): void {
  const list = threads.get(thread.docId) ?? [];
  list.push(thread);
  threads.set(thread.docId, list);
}

export function appendComment(
  docId: string,
  threadId: string,
  comment: CommentEntry,
): boolean {
  const list = threads.get(docId);
  if (!list) return false;
  const thread = list.find((t) => t.id === threadId);
  if (!thread) return false;
  thread.comments.push(comment);
  return true;
}

export function setThreadResolved(
  docId: string,
  threadId: string,
  resolved: boolean,
): boolean {
  const list = threads.get(docId);
  if (!list) return false;
  const thread = list.find((t) => t.id === threadId);
  if (!thread) return false;
  thread.resolved = resolved;
  return true;
}

export function deleteThread(docId: string, threadId: string): boolean {
  const list = threads.get(docId);
  if (!list) return false;
  const idx = list.findIndex((t) => t.id === threadId);
  if (idx === -1) return false;
  list.splice(idx, 1);
  return true;
}

// ─────────────────────────────────────────────────── Presence

export function saveIndicator(
  docId: string,
  indicator: Omit<PresenceRecord, "updatedAt">,
): void {
  let map = presence.get(docId);
  if (!map) {
    map = new Map();
    presence.set(docId, map);
  }
  map.set(indicator.clientId, { ...indicator, updatedAt: Date.now() });
}

export function getIndicators(
  docId: string,
): Record<string, Omit<PresenceRecord, "updatedAt">> {
  pruneStalePresence(docId);
  const map = presence.get(docId);
  if (!map) return {};
  const result: Record<string, Omit<PresenceRecord, "updatedAt">> = {};
  for (const [clientId, indicator] of map) {
    const { updatedAt: _, ...rest } = indicator;
    result[clientId] = rest;
  }
  return result;
}

// ─────────────────────────────────────────────────── Helpers

function emptyDocJSON(): NodeJSON {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
    ],
  };
}
