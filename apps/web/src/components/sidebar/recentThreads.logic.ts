import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import type { SidebarThreadSummary } from "~/types";
import { isSidebarSubagentThread, sidebarMainThreadFilter } from "../Sidebar.logic";

export interface RecentThreadEntry {
  readonly thread: SidebarThreadSummary;
  readonly finishedAt: string;
  readonly parentTitle: string | null;
}

const keyOf = (thread: SidebarThreadSummary) => `${thread.environmentId}:${thread.id}`;

function ancestors(thread: SidebarThreadSummary, byKey: ReadonlyMap<string, SidebarThreadSummary>) {
  const result: SidebarThreadSummary[] = [];
  const seen = new Set<string>();
  let current: SidebarThreadSummary | undefined = thread;
  while (current && !seen.has(keyOf(current))) {
    seen.add(keyOf(current));
    result.push(current);
    current = isSidebarSubagentThread(current)
      ? byKey.get(`${current.environmentId}:${current.lineage.parentThreadId}`)
      : undefined;
  }
  return result;
}

function finishedAt(thread: SidebarThreadSummary): string | null {
  if (thread.latestRun !== null) {
    return ["completed", "failed", "interrupted"].includes(thread.latestRun.status)
      ? thread.latestRun.completedAt
      : null;
  }
  return isSidebarSubagentThread(thread) && ["completed", "failed"].includes(thread.source.status)
    ? thread.updatedAt
    : null;
}

export function recentThreads(
  threads: readonly SidebarThreadSummary[],
  options: {
    readonly now: string;
    readonly count: number;
    readonly maxAgeMinutes: number;
    readonly includeSubagents: boolean;
    readonly pinnedOnly?: boolean;
    readonly dismissed?: Readonly<Record<string, string>>;
  },
): RecentThreadEntry[] {
  const byKey = new Map(threads.map((thread) => [keyOf(thread), thread]));
  const active = sidebarMainThreadFilter({ hideInactive: true }, threads);
  const cutoff =
    options.maxAgeMinutes > 0
      ? Date.parse(options.now) - options.maxAgeMinutes * 60_000
      : -Infinity;
  return threads
    .flatMap((thread) => {
      const subagent = isSidebarSubagentThread(thread);
      const at = finishedAt(thread);
      if (at && options.dismissed?.[keyOf(thread)] === at) return [];
      if (!at || !Number.isFinite(Date.parse(at)) || Date.parse(at) <= cutoff || active(thread))
        return [];
      if (subagent && !options.includeSubagents) return [];
      const chain = ancestors(thread, byKey);
      if (
        chain.some(
          (item) =>
            item.archivedAt !== null ||
            item.deletedAt !== null ||
            item.settledOverride === "settled" ||
            effectiveSnoozed(item, { now: options.now }),
        )
      )
        return [];
      const root = chain.at(-1)!;
      if (options.pinnedOnly && (isSidebarSubagentThread(root) || root.pinnedAt === null))
        return [];
      const parent = subagent
        ? byKey.get(`${thread.environmentId}:${thread.lineage.parentThreadId}`)
        : undefined;
      return [{ thread, finishedAt: at, parentTitle: parent?.title ?? null }];
    })
    .sort(
      (a, b) =>
        Date.parse(b.finishedAt) - Date.parse(a.finishedAt) ||
        keyOf(a.thread).localeCompare(keyOf(b.thread)),
    )
    .slice(0, options.count);
}

export function recentThreadVisibilityKeys(
  entries: readonly RecentThreadEntry[],
  threads: readonly SidebarThreadSummary[],
): ReadonlySet<string> {
  const byKey = new Map(threads.map((thread) => [keyOf(thread), thread]));
  return new Set(entries.flatMap(({ thread }) => ancestors(thread, byKey).map(keyOf)));
}
