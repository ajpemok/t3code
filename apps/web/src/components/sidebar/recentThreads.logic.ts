import { effectiveSnoozed } from "@t3tools/client-runtime/state/thread-settled";
import type { SidebarThreadSummary } from "~/types";
import type { OlderSettledShelfEnvironment } from "@t3tools/client-runtime/state/threads";
import type { EnvironmentId } from "@t3tools/contracts";
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
    readonly subagentCount?: number;
    readonly subagentMaxAgeMinutes?: number;
    readonly includeSubagents: boolean;
    readonly includeSettled?: boolean;
    readonly pinnedOnly?: boolean;
    readonly dismissed?: Readonly<Record<string, string>>;
  },
): RecentThreadEntry[] {
  const byKey = new Map(threads.map((thread) => [keyOf(thread), thread]));
  const active = sidebarMainThreadFilter({ hideInactive: true }, threads);
  const now = Date.parse(options.now);
  let threadCount = 0;
  let subagentCount = 0;
  return threads
    .flatMap((thread) => {
      const subagent = isSidebarSubagentThread(thread);
      const at = finishedAt(thread);
      const age = subagent
        ? (options.subagentMaxAgeMinutes ?? options.maxAgeMinutes)
        : options.maxAgeMinutes;
      const cutoff = age > 0 ? now - age * 60_000 : -Infinity;
      if (at && options.dismissed?.[keyOf(thread)] === at) return [];
      if (
        !at ||
        !Number.isFinite(Date.parse(at)) ||
        Date.parse(at) <= cutoff ||
        Date.parse(at) > now ||
        active(thread)
      )
        return [];
      if (subagent && !options.includeSubagents) return [];
      const chain = ancestors(thread, byKey);
      if (
        chain.some(
          (item) =>
            item.archivedAt !== null ||
            item.deletedAt !== null ||
            (!options.includeSettled && item.settledOverride === "settled") ||
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
    .filter(({ thread }) => {
      if (options.subagentCount === undefined) return threadCount++ < options.count;
      return isSidebarSubagentThread(thread)
        ? subagentCount++ < options.subagentCount
        : threadCount++ < options.count;
    });
}

export function todayThreads(
  threads: readonly SidebarThreadSummary[],
  recent: readonly RecentThreadEntry[],
  options: Pick<
    Parameters<typeof recentThreads>[1],
    "now" | "includeSubagents" | "pinnedOnly" | "dismissed"
  >,
): RecentThreadEntry[] {
  const recentKeys = new Set(recent.map(({ thread }) => keyOf(thread)));
  return recentThreads(threads, {
    ...options,
    count: Infinity,
    maxAgeMinutes: 1440,
    includeSettled: true,
  }).filter(({ thread }) => !recentKeys.has(keyOf(thread)));
}

export function recentThreadVisibilityKeys(
  entries: readonly RecentThreadEntry[],
  threads: readonly SidebarThreadSummary[],
): ReadonlySet<string> {
  const byKey = new Map(threads.map((thread) => [keyOf(thread), thread]));
  return new Set(entries.flatMap(({ thread }) => ancestors(thread, byKey).map(keyOf)));
}

export function completedHistoryPageRequests(
  requested: ReadonlyMap<EnvironmentId, number>,
  environments: ReadonlyMap<EnvironmentId, OlderSettledShelfEnvironment>,
  cutoff: number,
): ReadonlyMap<EnvironmentId, number> {
  let next: Map<EnvironmentId, number> | null = null;
  for (const [id, { pages }] of environments) {
    if (
      pages.status !== "ready" ||
      pages.frontier === null ||
      Date.parse(pages.frontier.settledAt) < cutoff
    )
      continue;
    next ??= new Map(requested);
    next.set(id, (requested.get(id) ?? 0) + 1);
  }
  return next ?? requested;
}
