import { Link } from "@tanstack/react-router";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { sortSettledThreads } from "@t3tools/client-runtime/state/thread-sort";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { AlarmClockOffIcon, Undo2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useNowMinute } from "~/hooks/useNowMinute";
import { useCloseInactiveProjectTabs } from "~/hooks/useCloseInactiveProjectTabs";
import { useThreadRouteRef } from "~/hooks/useThreadRouteTarget";
import type { useThreadActions } from "~/hooks/useThreadActions";
import { useServerConfigs, useQuietThreadShells } from "~/state/entities";
import { useEnvironmentScope } from "~/state/session";
import { buildThreadRouteParams } from "~/threadRoutes";
import type { SidebarThreadSummary } from "~/types";
import { partitionProjectSectionThreads } from "../Sidebar.logic";
import { RelativeTime } from "../RelativeTime";
import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function useProjectThreadSections(threads: readonly SidebarThreadSummary[]) {
  const configs = useServerConfigs();
  const minute = useNowMinute();
  const [wakeClock, setWakeClock] = useState(() => new Date().toISOString());
  const now = wakeClock > `${minute}:00.000Z` ? wakeClock : `${minute}:00.000Z`;
  const sections = partitionProjectSectionThreads(threads, {
    now,
    capabilities: new Map(
      [...configs].map(([id, config]) => [id, config.environment.capabilities]),
    ),
  });
  const nextWake = sections.snoozed.reduce((earliest, thread) => {
    const at = Date.parse(thread.snoozedUntil ?? "");
    return Number.isFinite(at) ? Math.min(earliest, at) : earliest;
  }, Infinity);
  useEffect(() => {
    if (!Number.isFinite(nextWake)) return;
    const timer = window.setTimeout(
      () => {
        const current = new Date().toISOString();
        if (current > now) setWakeClock(current);
      },
      Math.min(Math.max(0, nextWake - Date.now()) + 50, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [nextWake, now]);
  return sections;
}

type ShelfActions = Pick<ReturnType<typeof useThreadActions>, "unsnoozeThread" | "unsettleThread">;

function ShelfRow({
  thread,
  kind,
  actions,
  onContextMenu,
}: {
  readonly thread: SidebarThreadSummary;
  readonly kind: "snoozed" | "settled";
  readonly actions: ShelfActions;
  readonly onContextMenu: (
    ref: ReturnType<typeof scopeThreadRef>,
    position: { x: number; y: number },
  ) => Promise<void>;
}) {
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  const canOperate = useEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope);
  const [pending, setPending] = useState(false);
  const label = kind === "snoozed" ? "Unsnooze" : "Unsettle";
  const restore = async () => {
    if (pending || !canOperate) return;
    setPending(true);
    try {
      const result = await (kind === "snoozed"
        ? actions.unsnoozeThread(ref)
        : actions.unsettleThread(ref));
      if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
        const error = squashAtomCommandFailure(result);
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: `Failed to ${label.toLowerCase()} thread`,
            description: error instanceof Error ? error.message : "An error occurred.",
          }),
        );
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <li className="group/project-shelf flex min-h-8 min-w-0 items-center gap-1 px-2 text-xs">
      <Link
        to="/$environmentId/$threadId"
        params={buildThreadRouteParams(ref)}
        className="min-w-0 flex-1 truncate rounded-sm py-1 text-sidebar-muted-foreground hover:text-sidebar-foreground focus-visible:outline-1 focus-visible:outline-ring"
        title={thread.title}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onContextMenu(ref, { x: event.clientX, y: event.clientY });
        }}
      >
        {thread.title}
      </Link>
      <span className="text-3xs text-secondary-label">
        <RelativeTime
          timestamp={
            kind === "snoozed"
              ? (thread.snoozedUntil ?? thread.updatedAt)
              : (thread.settledAt ?? thread.updatedAt)
          }
          nowLabel="now"
        />
      </span>
      {canOperate ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                disabled={pending}
                onClick={() => void restore()}
                aria-label={`${label} ${thread.title}`}
                className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-sidebar-muted-foreground hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:outline-1 focus-visible:outline-ring disabled:opacity-50"
              />
            }
          >
            {kind === "snoozed" ? (
              <AlarmClockOffIcon className="size-3.5" />
            ) : (
              <Undo2Icon className="size-3.5" />
            )}
          </TooltipTrigger>
          <TooltipPopup>{label}</TooltipPopup>
        </Tooltip>
      ) : null}
    </li>
  );
}

export function ProjectThreadShelves({ actions }: { readonly actions: ShelfActions }) {
  const threads = useQuietThreadShells();
  const sections = useProjectThreadSections(threads);
  const selected = useThreadRouteRef();
  const inactiveTabs = useCloseInactiveProjectTabs({
    threads,
    selectedThreadKey: selected ? scopedThreadKey(selected) : null,
  });
  const [snoozedExpanded, setSnoozedExpanded] = useLocalStorage(
    "t3code:sidebar:snoozed-expanded",
    false,
    Schema.Boolean,
  );
  const [settledExpanded, setSettledExpanded] = useLocalStorage(
    "t3code:sidebar:settled-expanded",
    false,
    Schema.Boolean,
  );
  const [limit, setLimit] = useState(20);
  const snoozed = sections.snoozed.toSorted(
    (a, b) => Date.parse(a.snoozedUntil ?? "") - Date.parse(b.snoozedUntil ?? ""),
  );
  const settled = sortSettledThreads(sections.settled);
  return (
    <div className="mt-auto px-2 pt-2" data-testid="project-thread-shelves">
      {(
        [
          {
            kind: "snoozed",
            label: "Snoozed",
            threads: snoozed,
            expanded: snoozedExpanded,
            toggle: () => setSnoozedExpanded(!snoozedExpanded),
          },
          {
            kind: "settled",
            label: "Settled",
            threads: settled,
            expanded: settledExpanded,
            toggle: () => setSettledExpanded(!settledExpanded),
          },
        ] as const
      ).map((shelf) => (
        <section key={shelf.kind} aria-label={shelf.label}>
          <CollapsibleSectionHeader
            expanded={shelf.expanded}
            onClick={shelf.toggle}
            tone={shelf.kind === "snoozed" ? "info" : "muted"}
          >
            {shelf.label} ({shelf.threads.length})
          </CollapsibleSectionHeader>
          {shelf.expanded ? (
            <ul>
              {shelf.threads.slice(0, limit).map((thread) => (
                <ShelfRow
                  key={scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id))}
                  thread={thread}
                  kind={shelf.kind}
                  actions={actions}
                  onContextMenu={inactiveTabs.showTaskContextMenu}
                />
              ))}
            </ul>
          ) : null}
          {shelf.expanded && shelf.threads.length > limit ? (
            <button
              type="button"
              onClick={() => setLimit(limit + 20)}
              className="h-8 w-full cursor-pointer text-xs text-sidebar-muted-foreground hover:text-sidebar-foreground"
            >
              Show {Math.min(20, shelf.threads.length - limit)} more
            </button>
          ) : null}
        </section>
      ))}
    </div>
  );
}
