import { useAtomValue } from "@effect/atom-react";
import { resolveSidebarSubagentVisibility } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import * as Schema from "effect/Schema";
import {
  recentThreads,
  recentThreadVisibilityKeys,
  todayThreads,
  type RecentThreadEntry,
} from "~/components/sidebar/recentThreads.logic";
import { environmentThreadShells } from "~/state/threads";
import { useClientSettings } from "./useSettings";
import { useNowMinute } from "./useNowMinute";
import { useLocalStorage, writeLocalStorageValue } from "./useLocalStorage";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";

const DISMISSED_KEY = "t3code:sidebar:recent-dismissed";
const DISMISSED_SCHEMA = Schema.Record(Schema.String, Schema.String);
const decodeDismissed = Schema.decodeSync(Schema.fromJsonString(DISMISSED_SCHEMA));
const NO_DISMISSALS: Record<string, string> = {};

export function restoreDismissedRecentThreads() {
  writeLocalStorageValue(DISMISSED_KEY, NO_DISMISSALS, NO_DISMISSALS, DISMISSED_SCHEMA);
}

export function dismissRecentThread(entry: RecentThreadEntry) {
  const key = `${entry.thread.environmentId}:${entry.thread.id}`;
  writeLocalStorageValue(
    DISMISSED_KEY,
    (current) => ({ ...current, [key]: entry.finishedAt }),
    NO_DISMISSALS,
    DISMISSED_SCHEMA,
  );
  const id = toastManager.add(
    stackedThreadToast({
      type: "info",
      title: "Dismissed from Recent",
      description: entry.thread.title,
      actionProps: {
        children: "Undo",
        onClick: () => {
          writeLocalStorageValue(
            DISMISSED_KEY,
            (current) => {
              if (current[key] !== entry.finishedAt) return current;
              const next = { ...current };
              delete next[key];
              return next;
            },
            NO_DISMISSALS,
            DISMISSED_SCHEMA,
          );
          toastManager.close(id);
        },
      },
    }),
  );
}

const EMPTY_RECENT = {
  entries: [] as readonly RecentThreadEntry[],
  today: [] as readonly RecentThreadEntry[],
  retainedKeys: new Set<string>() as ReadonlySet<string>,
  showSection: false,
  showToday: false,
};

function sameEntries(left: readonly RecentThreadEntry[], right: readonly RecentThreadEntry[]) {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.thread === right[index]!.thread &&
        entry.finishedAt === right[index]!.finishedAt &&
        entry.parentTitle === right[index]!.parentTitle,
    )
  );
}

const recentAtom = Atom.family((key: string | null) => {
  let previous = EMPTY_RECENT;
  return Atom.make((get) => {
    if (key === null) return EMPTY_RECENT;
    const [
      count,
      age,
      childCount,
      childAge,
      include,
      pinned,
      show,
      keep,
      showToday,
      now,
      dismissed,
    ] = key.split("|");
    if (show !== "true" && keep !== "true" && showToday !== "true") return EMPTY_RECENT;
    const threads = get(environmentThreadShells.quietThreadShellsAtom);
    const entries = recentThreads(threads, {
      count: Number(count),
      maxAgeMinutes: Number(age),
      subagentCount: Number(childCount),
      subagentMaxAgeMinutes: Number(childAge),
      includeSubagents: include === "true",
      pinnedOnly: pinned === "true",
      now: now!,
      dismissed: decodeDismissed(decodeURIComponent(dismissed!)),
    });
    const next = {
      entries,
      today:
        showToday === "true"
          ? todayThreads(threads, show === "true" ? entries : [], {
              includeSubagents: include === "true",
              pinnedOnly: pinned === "true",
              now: now!,
              dismissed: decodeDismissed(decodeURIComponent(dismissed!)),
            })
          : EMPTY_RECENT.today,
      showToday: showToday === "true",
      retainedKeys:
        keep === "true" ? recentThreadVisibilityKeys(entries, threads) : EMPTY_RECENT.retainedKeys,
      showSection: show === "true",
    };
    if (
      previous.showSection === next.showSection &&
      previous.showToday === next.showToday &&
      sameEntries(previous.entries, entries) &&
      sameEntries(previous.today, next.today) &&
      previous.retainedKeys.size === next.retainedKeys.size &&
      [...previous.retainedKeys].every((key) => next.retainedKeys.has(key))
    )
      return previous;
    previous = next;
    return next;
  }).pipe(Atom.setIdleTTL(0));
});

export function useRecentThreads(enabled = true) {
  const [dismissed] = useLocalStorage(DISMISSED_KEY, NO_DISMISSALS, DISMISSED_SCHEMA);
  const settings = useClientSettings((s) => ({
    count: s.sidebarRecentThreadCount ?? 5,
    age: s.sidebarRecentThreadMaxAgeMinutes ?? 60,
    childCount: s.sidebarRecentSubagentCount ?? 5,
    childAge: s.sidebarRecentSubagentMaxAgeMinutes ?? 60,
    showToday: s.sidebarTodaySectionEnabled ?? true,
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
        settings.childCount,
        settings.childAge,
        settings.include,
        settings.pinned,
        settings.show,
        settings.keep,
        settings.showToday,
        `${minute}:00.000Z`,
        encodeURIComponent(JSON.stringify(dismissed)),
      ].join("|")
    : null;
  const recent = useAtomValue(recentAtom(key));
  return { ...recent, dismissedCount: Object.keys(dismissed).length };
}
