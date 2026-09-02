/**
 * In-process broadcasters for the dev-server. No Redis — a single Node
 * process, multiple browser tabs hitting it via long-poll.
 *
 *   listenForCommit(docId, version)
 *      → resolves when a commit at-or-above `version` is broadcast,
 *        or after the timeout elapses (whichever comes first).
 *
 *   broadcastCommit(docId, commit)
 *      → wakes any listeners parked for this docId.
 *
 * Same shape for presence (different listener identity).
 */

type CommitWaiter = {
  resolve: (committed: boolean) => void;
  minVersion: number;
};

const commitWaiters = new Map<string, Set<CommitWaiter>>();

const PRESENCE_LISTEN_TIMEOUT_MS = 4_000;
const COMMIT_LISTEN_TIMEOUT_MS = 4_000;

export const collabBroadcaster = {
  async broadcastCommit(
    docId: string,
    commit: { version: number },
  ): Promise<void> {
    const set = commitWaiters.get(docId);
    if (!set) return;
    for (const waiter of [...set]) {
      if (waiter.minVersion <= commit.version) {
        waiter.resolve(true);
        set.delete(waiter);
      }
    }
  },
  async createCommitListener(docId: string, version: number) {
    let waiter: CommitWaiter | null = null;
    const promise = new Promise<boolean>((resolve) => {
      waiter = { resolve, minVersion: version };
      let set = commitWaiters.get(docId);
      if (!set) {
        set = new Set();
        commitWaiters.set(docId, set);
      }
      set.add(waiter);
    });

    const cleanup = () => {
      const set = commitWaiters.get(docId);
      if (set && waiter) set.delete(waiter);
    };

    const listen = async (): Promise<boolean> => {
      try {
        return await Promise.race([
          promise,
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), COMMIT_LISTEN_TIMEOUT_MS);
          }),
        ]);
      } finally {
        cleanup();
      }
    };

    const abort = async (): Promise<void> => {
      cleanup();
    };

    return { listen, abort };
  },
};

type PresenceListener = {
  docId: string;
  excludeClientId: string;
  refs: Record<string, string>;
  resolve: () => void;
};

const presenceListeners = new Map<string, Set<PresenceListener>>();

export const presenceBroadcaster = {
  async broadcastIndicator(
    docId: string,
    indicator: { clientId: string; ref: string },
  ): Promise<void> {
    const set = presenceListeners.get(docId);
    if (!set) return;
    for (const listener of [...set]) {
      if (listener.excludeClientId === indicator.clientId) continue;
      if (listener.refs[indicator.clientId] === indicator.ref) continue;
      listener.resolve();
      set.delete(listener);
    }
  },
  async createPresenceListener(
    docId: string,
    excludeClientId: string,
    refs: Record<string, string> = {},
  ) {
    const {promise, resolve} = Promise.withResolvers()
    const listener: PresenceListener = {
      docId,
      excludeClientId,
      refs,
      resolve,
    };
    let set = presenceListeners.get(docId);
    if (!set) {
      set = new Set();
      presenceListeners.set(docId, set);
    }
    set.add(listener);
    const listen = async () => {
      return await Promise.race([
        promise,
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), PRESENCE_LISTEN_TIMEOUT_MS)
        })
      ]).finally(async () => {
       set.delete(listener)
      })
    }

    const abort = async () => {
      set.delete(listener)
    }

    return {listen, abort}
  },
};

export const presencePersistenceManager = {
  // Filled in by the route file using the storage adapter directly.
};
