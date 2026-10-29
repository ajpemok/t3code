import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId, ThreadId, ProjectId } from "@t3tools/contracts";
import { resolveSidebarSubagentVisibility } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import { useEffect } from "react";
import { isSidebarSubagentThread } from "~/components/Sidebar.logic";
import { completedHistoryPageRequests } from "~/components/sidebar/recentThreads.logic";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useOlderSettledShelf } from "~/state/olderSettledShelf";
import { environmentThreadShells, threadFamilies } from "~/state/threads";
import { useClientSettings } from "./useSettings";
import { useNowMinute } from "./useNowMinute";

const rootsAtom = Atom.family((scope: string) =>
  Atom.make((get) => {
    const keys = JSON.parse(scope) as string[] | null;
    const threads = get(environmentThreadShells.quietThreadShellsAtom);
    return JSON.stringify(
      threads
        .filter(
          (thread) =>
            !isSidebarSubagentThread(thread) &&
            thread.archivedAt === null &&
            thread.deletedAt === null &&
            (keys === null || keys.includes(`${thread.environmentId}:${thread.projectId}`)),
        )
        .map((thread) => [thread.environmentId, thread.id])
        .sort(),
    );
  }),
);

const familyStatusAtom = Atom.family((key: string) =>
  Atom.make((get) => {
    let status = 0;
    for (const [id, root] of JSON.parse(key) as [EnvironmentId, ThreadId][]) {
      const result = get(threadFamilies.familyAtom(id, root));
      if (result.waiting || AsyncResult.isInitial(result)) status |= 1;
      else if (AsyncResult.isFailure(result)) status |= 2;
    }
    return status;
  }),
);

export function useCompletedThreadHistory(input: {
  readonly enabled: boolean;
  readonly includeSubagents: boolean;
  readonly includeSettled: boolean;
  readonly scopedProjectKeys?: ReadonlySet<string> | null;
}) {
  const rootsKey = useAtomValue(
    rootsAtom(JSON.stringify(input.scopedProjectKeys ? [...input.scopedProjectKeys].sort() : null)),
  );
  const roots = JSON.parse(rootsKey) as [EnvironmentId, ThreadId][];
  const scopes = [...new Set(roots.map(([id]) => id))].map((environmentId) => ({
    environmentId,
    projectIds:
      input.scopedProjectKeys == null
        ? null
        : [...input.scopedProjectKeys].flatMap((key) => {
            const prefix = `${environmentId}:`;
            return key.startsWith(prefix) ? [key.slice(prefix.length) as ProjectId] : [];
          }),
  }));
  const readSettled = input.enabled && input.includeSettled;
  const shelf = useOlderSettledShelf({ scopes, expanded: readSettled, visibleCount: 0 });
  const minute = useNowMinute();
  const wanted = readSettled
    ? completedHistoryPageRequests(
        shelf.pages,
        shelf.environments,
        Date.parse(`${minute}:00.000Z`) - 86400000,
      )
    : shelf.pages;
  const { grow, pages } = shelf;
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reads omitted settled families only through the past-day frontier while a completed shelf is open
  useEffect(() => {
    if (wanted !== pages) grow(wanted);
  }, [wanted, pages, grow]);
  const showSubagents = useClientSettings(
    (s) =>
      resolveSidebarSubagentVisibility(s) !== "hide" && (s.sidebarRecentIncludeSubagents ?? true),
  );
  const include = input.enabled && input.includeSubagents && showSubagents;
  const status = useAtomValue(familyStatusAtom(include ? rootsKey : "[]"));
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- mounts omitted idle children only while the user views a Subagents tab, sharing the native family cache
  useEffect(() => {
    if (!include) return;
    const releases = (JSON.parse(rootsKey) as [EnvironmentId, ThreadId][]).map(([id, root]) =>
      threadFamilies.mount(appAtomRegistry, id, root),
    );
    return () => {
      for (const release of releases) release();
    };
  }, [include, rootsKey]);
  return {
    loading: shelf.loading || (status & 1) !== 0,
    failed: shelf.failed || (status & 2) !== 0,
    retry: () => {
      shelf.retry();
      if (include)
        for (const [id, root] of roots) {
          if (AsyncResult.isFailure(appAtomRegistry.get(threadFamilies.familyAtom(id, root))))
            threadFamilies.refresh(appAtomRegistry, id, root);
        }
    },
  };
}
