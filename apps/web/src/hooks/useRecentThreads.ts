import { useAtomValue } from "@effect/atom-react";
import { resolveSidebarSubagentVisibility } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import {
  recentThreads,
  recentThreadVisibilityKeys,
  type RecentThreadEntry,
} from "~/components/sidebar/recentThreads.logic";
import { environmentThreadShells } from "~/state/threads";
import { useClientSettings } from "./useSettings";
import { useNowMinute } from "./useNowMinute";

const EMPTY_RECENT = {
  entries: [] as readonly RecentThreadEntry[],
  retainedKeys: new Set<string>() as ReadonlySet<string>,
  showSection: false,
};

const recentAtom = Atom.family((key: string | null) => {
  let previous = EMPTY_RECENT;
  return Atom.make((get) => {
    if (key === null) return EMPTY_RECENT;
    const [count, age, include, pinned, show, keep, now] = key.split("|");
    if (show !== "true" && keep !== "true") return EMPTY_RECENT;
    const threads = get(environmentThreadShells.quietThreadShellsAtom);
    const entries = recentThreads(threads, {
      count: Number(count),
      maxAgeMinutes: Number(age),
      includeSubagents: include === "true",
      pinnedOnly: pinned === "true",
      now: now!,
    });
    const next = {
      entries,
      retainedKeys:
        keep === "true" ? recentThreadVisibilityKeys(entries, threads) : EMPTY_RECENT.retainedKeys,
      showSection: show === "true",
    };
    if (
      previous.showSection === next.showSection &&
      previous.entries.length === entries.length &&
      previous.entries.every(
        (entry, index) =>
          entry.thread === entries[index]!.thread &&
          entry.finishedAt === entries[index]!.finishedAt &&
          entry.parentTitle === entries[index]!.parentTitle,
      ) &&
      previous.retainedKeys.size === next.retainedKeys.size &&
      [...previous.retainedKeys].every((key) => next.retainedKeys.has(key))
    )
      return previous;
    previous = next;
    return next;
  }).pipe(Atom.setIdleTTL(0));
});

export function useRecentThreads(enabled = true) {
  const settings = useClientSettings((s) => ({
    count: s.sidebarRecentThreadCount ?? 5,
    age: s.sidebarRecentThreadMaxAgeMinutes ?? 60,
    include:
      (s.sidebarRecentIncludeSubagents ?? true) && resolveSidebarSubagentVisibility(s) !== "hide",
    pinned: s.sidebarPinnedOnlyEnabled,
    show: s.sidebarRecentSectionEnabled ?? true,
    keep: s.sidebarKeepRecentThreadsVisible ?? true,
  }));
  const minute = useNowMinute();
  const key = enabled
    ? [
        settings.count,
        settings.age,
        settings.include,
        settings.pinned,
        settings.show,
        settings.keep,
        `${minute}:00.000Z`,
      ].join("|")
    : null;
  return useAtomValue(recentAtom(key));
}
