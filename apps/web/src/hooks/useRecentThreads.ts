import { useAtomValue } from "@effect/atom-react";
import { resolveSidebarSubagentVisibility } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import * as Schema from "effect/Schema";
import {
  recentThreads,
  recentThreadVisibilityKeys,
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
  retainedKeys: new Set<string>() as ReadonlySet<string>,
  showSection: false,
};

const recentAtom = Atom.family((key: string | null) => {
  let previous = EMPTY_RECENT;
  return Atom.make((get) => {
    if (key === null) return EMPTY_RECENT;
    const [count, age, include, pinned, show, keep, now, dismissed] = key.split("|");
    if (show !== "true" && keep !== "true") return EMPTY_RECENT;
    const threads = get(environmentThreadShells.quietThreadShellsAtom);
    const entries = recentThreads(threads, {
      count: Number(count),
      maxAgeMinutes: Number(age),
      includeSubagents: include === "true",
      pinnedOnly: pinned === "true",
      now: now!,
      dismissed: decodeDismissed(decodeURIComponent(dismissed!)),
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
  const [dismissed] = useLocalStorage(DISMISSED_KEY, NO_DISMISSALS, DISMISSED_SCHEMA);
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
        encodeURIComponent(JSON.stringify(dismissed)),
      ].join("|")
    : null;
  const recent = useAtomValue(recentAtom(key));
  return { ...recent, dismissedCount: Object.keys(dismissed).length };
}
