/**
 * /api/docs/:docId/{commits,snapshots,comments,presence}
 *
 * Wires the pitter-patter CollabAuthority + PresenceAuthority +
 * withVersionHistory wrapper to our in-memory storage and in-process
 * broadcasters. Comments are DIY because the upstream comments-server
 * is incomplete in this repo.
 *
 * Schema is hard-coded to prosemirror-schema-basic — collab needs a
 * stable schema on both ends, and the collab editor in Storybook uses
 * the same basic schema.
 */

import {
  CollabAuthority,
  TooMuchContentionError,
} from "@pitter-patter/collab-server";
import {
  PresenceAuthority,
  type PresenceIndicator,
} from "@pitter-patter/presence-server";
import type { CommitJSON } from "@stepwisehq/prosemirror-collab-commit/collab-commit";
import { Hono } from "hono";
import { schema as basicSchema } from "prosemirror-schema-basic";

import { collabBroadcaster, presenceBroadcaster } from "./broadcaster";
import {
  appendComment,
  appendCommit,
  appendSnapshot,
  createThread,
  deleteThread,
  getCommitByRef,
  getCommitsAfter,
  getDoc,
  getIndicators,
  getLatestSnapshot,
  getSnapshots,
  listThreads,
  saveDoc,
  saveIndicator,
  setThreadResolved,
  type CommentEntry,
  type CommentThread,
} from "./storage";

// ─────────────────────────────────────────────────── Authorities

// Single-process dev server — no real transactions.
type Tx = null;

const collabAuthority = new CollabAuthority<Tx>(
    {
      schema: basicSchema,
      runWithTransaction: async (callback) => callback(null),
      getDoc: async (_tr, docId) => {
        const doc = getDoc(docId);
        return {
          docJSON: doc.content,
          version: doc.version,
          lastUpdatedTimestamp: doc.lastUpdatedTimestamp,
        };
      },
      getCommit: async (_tr, docId, ref) => getCommitByRef(docId, ref),
      getCommits: async (_tr, docId, version) =>
        getCommitsAfter(docId, version),
      saveDoc: async (_tr, docId, docJSON, version, lastUpdatedTimestamp) => {
        saveDoc(docId, docJSON, version, lastUpdatedTimestamp ?? Date.now());
      },
      saveCommit: async (_tr, docId, ref, version, steps) => {
        appendCommit(docId, ref, version, steps);
      },
      broadcastManager: collabBroadcaster,
    },
);

const presenceAuthority = new PresenceAuthority({
  persistenceManager: {
    saveIndicator: async (docId, indicator) => {
      saveIndicator(docId, indicator);
    },
    getIndicators: async (docId) => getIndicators(docId) as Record<string, PresenceIndicator>,
  },
  broadcastManager: presenceBroadcaster,
});

// ─────────────────────────────────────────────────── Routes

export const collabRoutes = new Hono();

// ─── Commits ──────────────────────────────────────────────

collabRoutes.get("/:docId/commits", async (c) => {
  const docId = c.req.param("docId");
  const versionStr = c.req.query("version");
  const version = versionStr ? Number.parseInt(versionStr, 10) : 0;
  if (Number.isNaN(version)) {
    return c.json({ error: "version must be a number" }, 400);
  }
  const commits = await collabAuthority.listenForCommit(docId, version);
  return c.json(commits);
});

collabRoutes.post("/:docId/commits", async (c) => {
  const docId = c.req.param("docId");
  const body = (await c.req.json().catch(() => null)) as CommitJSON | null;
  if (!body || typeof body.ref !== "string" || typeof body.version !== "number") {
    return c.json({ error: "Invalid commit body" }, 400);
  }
  try {
    await collabAuthority.receiveCommit(docId, body);
  } catch (e) {
    if (e instanceof TooMuchContentionError) {
      return c.json({ error: "Contention" }, 409);
    }
    throw e;
  }
  return c.body(null, 204);
});

// ─── Snapshots ────────────────────────────────────────────

collabRoutes.get("/:docId/snapshots", async (c) => {
  const docId = c.req.param("docId");
  const versionStr = c.req.query("version");
  const afterVersion = versionStr ? Number.parseInt(versionStr, 10) : undefined;
  const list = getSnapshots(docId, afterVersion);
  return c.json(
    list.map((s) => ({
      snapshotId: s.snapshotId,
      snapshotJSON: s.content,
      docId: s.docId,
      version: s.version,
      createdAt: s.createdAt,
    })),
  );
});

// ─── Comments ─────────────────────────────────────────────

collabRoutes.get("/:docId/comments/threads", async (c) => {
  const docId = c.req.param("docId");
  return c.json(listThreads(docId));
});

collabRoutes.post("/:docId/comments/threads", async (c) => {
  const docId = c.req.param("docId");
  const body = (await c.req.json().catch(() => null)) as Partial<{
    id: string;
    range: { from: number; to: number };
    initial: { authorId: string; authorName: string; body: string };
  }> | null;
  if (
    !body ||
    !body.id ||
    !body.range ||
    !body.initial ||
    typeof body.initial.body !== "string"
  ) {
    return c.json(
      { error: "Body must be { id, range, initial: { authorId, authorName, body } }" },
      400,
    );
  }
  const now = Date.now();
  const firstComment: CommentEntry = {
    id: `cmt-${now}`,
    threadId: body.id,
    authorId: body.initial.authorId,
    authorName: body.initial.authorName,
    body: body.initial.body,
    createdAt: now,
  };
  const thread: CommentThread = {
    id: body.id,
    docId,
    range: body.range,
    comments: [firstComment],
    resolved: false,
    createdAt: now,
  };
  createThread(thread);
  return c.json(thread, 201);
});

collabRoutes.post("/:docId/comments/threads/:threadId/comments", async (c) => {
  const docId = c.req.param("docId");
  const threadId = c.req.param("threadId");
  const body = (await c.req.json().catch(() => null)) as Partial<{
    authorId: string;
    authorName: string;
    body: string;
  }> | null;
  if (!body || !body.body || !body.authorId) {
    return c.json({ error: "Body must be { authorId, authorName, body }" }, 400);
  }
  const now = Date.now();
  const comment: CommentEntry = {
    id: `cmt-${now}`,
    threadId,
    authorId: body.authorId,
    authorName: body.authorName ?? body.authorId,
    body: body.body,
    createdAt: now,
  };
  const ok = appendComment(docId, threadId, comment);
  if (!ok) return c.json({ error: "Thread not found" }, 404);
  return c.json(comment, 201);
});

collabRoutes.patch("/:docId/comments/threads/:threadId", async (c) => {
  const docId = c.req.param("docId");
  const threadId = c.req.param("threadId");
  const body = (await c.req.json().catch(() => null)) as Partial<{
    resolved: boolean;
  }> | null;
  if (!body || typeof body.resolved !== "boolean") {
    return c.json({ error: "Body must be { resolved: boolean }" }, 400);
  }
  const ok = setThreadResolved(docId, threadId, body.resolved);
  if (!ok) return c.json({ error: "Thread not found" }, 404);
  return c.body(null, 204);
});

collabRoutes.delete("/:docId/comments/threads/:threadId", async (c) => {
  const docId = c.req.param("docId");
  const threadId = c.req.param("threadId");
  const ok = deleteThread(docId, threadId);
  if (!ok) return c.json({ error: "Thread not found" }, 404);
  return c.body(null, 204);
});

// ─── Presence ─────────────────────────────────────────────

collabRoutes.post("/:docId/presence", async (c) => {
  const docId = c.req.param("docId");
  const body = (await c.req.json().catch(() => null)) as Partial<{
    clientId: string;
    refs: Record<string, string>;
  }> | null;
  if (!body || typeof body.clientId !== "string") {
    return c.json({ error: "Body must include clientId" }, 400);
  }
  const result = await presenceAuthority.listenForPresence(
    docId,
    body.clientId,
    body.refs ?? {},
  );
  return c.json(result);
});

collabRoutes.post("/:docId/presence/:clientId", async (c) => {
  const docId = c.req.param("docId");
  const indicator = (await c.req.json().catch(() => null)) as PresenceIndicator | null;
  if (!indicator || typeof indicator.clientId !== "string") {
    return c.json({ error: "Invalid indicator body" }, 400);
  }
  await presenceAuthority.updatePresence(docId, indicator);
  return c.body(null, 204);
});
