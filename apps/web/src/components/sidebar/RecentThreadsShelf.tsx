import { Link } from "@tanstack/react-router";
import {
  scopeProjectRef,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import * as Schema from "effect/Schema";
import { GitForkIcon, Undo2Icon } from "lucide-react";
import { useId, useState } from "react";
import { useRecentThreads, restoreDismissedRecentThreads } from "~/hooks/useRecentThreads";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { useCloseInactiveProjectTabs } from "~/hooks/useCloseInactiveProjectTabs";
import { useThreadRouteRef } from "~/hooks/useThreadRouteTarget";
import { cn } from "~/lib/utils";
import { projectTintColor } from "~/projectIdentity";
import { useProject } from "~/state/entities";
import { buildThreadRouteParams } from "~/threadRoutes";
import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { RelativeTime } from "../RelativeTime";
import { isSidebarSubagentThread } from "../Sidebar.logic";
import type { RecentThreadEntry } from "./recentThreads.logic";
import { ThreadModelIdentity } from "./ThreadModelDetails";
import { RecentThreadDismissButton } from "./RecentThreadDismissButton";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { useCompletedThreadHistory } from "~/hooks/useCompletedThreadHistory";

const SHELF_KIND = Schema.Literals(["threads", "subagents"]);

function RecentRow({
  entry,
  onContextMenu,
  dismissible,
}: {
  readonly entry: RecentThreadEntry;
  readonly onContextMenu: ReturnType<typeof useCloseInactiveProjectTabs>["showTaskContextMenu"];
  readonly dismissible: boolean;
}) {
  const { thread, finishedAt, parentTitle } = entry;
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  const project = useProject(scopeProjectRef(thread.environmentId, thread.projectId));
  const subagent = isSidebarSubagentThread(thread);
  return (
    <li
      data-project-color={projectTintColor(project)}
      className={cn(
        "project-tint-row group/recent flex min-h-8 min-w-0 items-center gap-2 px-2 text-xs",
        subagent && "project-tint-subagent",
      )}
    >
      {subagent ? (
        <GitForkIcon
          aria-label="Subagent"
          className="size-3.5 shrink-0 text-sidebar-muted-foreground"
        />
      ) : null}
      <Link
        to="/$environmentId/$threadId"
        params={buildThreadRouteParams(ref)}
        className="min-w-0 flex-1 truncate rounded-sm py-1 text-sidebar-muted-foreground hover:text-sidebar-foreground focus-visible:outline-1 focus-visible:outline-ring"
        title={parentTitle ? `${thread.title} · ${parentTitle}` : thread.title}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onContextMenu(ref, { x: event.clientX, y: event.clientY });
        }}
      >
        {thread.title}
      </Link>
      {dismissible ? <RecentThreadDismissButton entry={entry} /> : null}
      <ThreadModelIdentity thread={thread} />
      <span className="w-12 shrink-0 text-right text-3xs text-secondary-label tabular-nums">
        <RelativeTime timestamp={finishedAt} nowLabel="now" />
      </span>
    </li>
  );
}

function CompletedShelf({
  name,
  entries,
  dismissedCount = 0,
  scopedProjectKeys,
}: {
  readonly name: "Recent" | "Today";
  readonly entries: readonly RecentThreadEntry[];
  readonly dismissedCount?: number;
  readonly scopedProjectKeys?: ReadonlySet<string> | null;
}) {
  const id = useId();
  const selected = useThreadRouteRef();
  const [expanded, setExpanded] = useLocalStorage(
    `t3code:sidebar:${name.toLowerCase()}-expanded`,
    true,
    Schema.Boolean,
  );
  const [kind, setKind] = useLocalStorage(
    `t3code:sidebar:${name.toLowerCase()}-kind`,
    "threads",
    SHELF_KIND,
  );
  const [readSubagents, setReadSubagents] = useState(kind === "subagents");
  const [visibleCount, setVisibleCount] = useState(5);
  const selectKind = (next: "threads" | "subagents") => {
    if (next === "subagents") setReadSubagents(true);
    setKind(next);
  };
  const history = useCompletedThreadHistory({
    enabled: expanded,
    includeSubagents: readSubagents || kind === "subagents",
    scopedProjectKeys: scopedProjectKeys ?? null,
  });
  const scopedEntries =
    scopedProjectKeys == null
      ? entries
      : entries.filter(({ thread }) =>
          scopedProjectKeys.has(`${thread.environmentId}:${thread.projectId}`),
        );
  const inactiveTabs = useCloseInactiveProjectTabs({
    threads: scopedEntries.map((entry) => entry.thread),
    selectedThreadKey: selected ? scopedThreadKey(selected) : null,
  });
  const visible = scopedEntries.filter(
    ({ thread }) => isSidebarSubagentThread(thread) === (kind === "subagents"),
  );
  return (
    <section aria-label={name}>
      <div className="flex items-center">
        <div className="min-w-0 flex-1">
          <CollapsibleSectionHeader
            expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            tone="muted"
          >
            {name} ({scopedEntries.length})
          </CollapsibleSectionHeader>
        </div>
        {name === "Recent" && dismissedCount > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost-muted"
                  aria-label="Restore dismissed recent threads"
                  onClick={restoreDismissedRecentThreads}
                />
              }
            >
              <Undo2Icon className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup>Restore dismissed recent threads</TooltipPopup>
          </Tooltip>
        ) : null}
      </div>
      {expanded ? (
        <>
          <div
            role="tablist"
            aria-label={`${name} tasks`}
            className="flex gap-1 px-2 pb-1"
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? "threads"
                  : event.key === "End"
                    ? "subagents"
                    : kind === "threads"
                      ? "subagents"
                      : "threads";
              selectKind(next);
              event.currentTarget
                .querySelector<HTMLButtonElement>(`[data-kind="${next}"]`)
                ?.focus();
            }}
          >
            {(["threads", "subagents"] as const).map((tab) => (
              <button
                type="button"
                role="tab"
                key={tab}
                data-kind={tab}
                id={`${id}-${tab}`}
                aria-controls={`${id}-panel`}
                aria-selected={kind === tab}
                tabIndex={kind === tab ? 0 : -1}
                onClick={() => selectKind(tab)}
                className="min-h-7 rounded-sm px-2 text-2xs text-sidebar-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring aria-selected:bg-accent aria-selected:text-sidebar-foreground"
              >
                {tab === "threads" ? "Threads" : "Subagents"} (
                {
                  scopedEntries.filter(
                    ({ thread }) => isSidebarSubagentThread(thread) === (tab === "subagents"),
                  ).length
                }
                )
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${kind}`}>
            <ul>
              {(name === "Today" ? visible.slice(0, visibleCount) : visible).map((entry) => (
                <RecentRow
                  key={scopedThreadKey(scopeThreadRef(entry.thread.environmentId, entry.thread.id))}
                  entry={entry}
                  onContextMenu={inactiveTabs.showTaskContextMenu}
                  dismissible={name === "Recent"}
                />
              ))}
            </ul>
            {name === "Today" && visible.length > visibleCount ? (
              <Button
                variant="ghost-muted"
                size="xs"
                onClick={() => setVisibleCount(visibleCount + 5)}
              >
                Show More
              </Button>
            ) : null}
            {history.failed ? (
              <button
                type="button"
                onClick={history.retry}
                className="px-4 py-1 text-2xs text-sidebar-foreground underline"
              >
                Retry loading history
              </button>
            ) : history.loading ? (
              <p role="status" className="px-4 py-1 text-2xs text-sidebar-muted-foreground">
                Loading history…
              </p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-1 text-2xs text-sidebar-muted-foreground">
                No finished {kind}.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function RecentThreadsShelf({
  scopedProjectKeys,
  className = "mt-auto px-2 pt-2",
}: {
  readonly scopedProjectKeys?: ReadonlySet<string> | null;
  readonly className?: string;
}) {
  const recent = useRecentThreads();
  if (!recent.showSection && !recent.showToday) return null;
  return (
    <div className={className}>
      {recent.showSection ? (
        <CompletedShelf
          name="Recent"
          entries={recent.entries}
          dismissedCount={recent.dismissedCount}
          scopedProjectKeys={scopedProjectKeys ?? null}
        />
      ) : null}
      {recent.showToday ? (
        <CompletedShelf
          name="Today"
          entries={recent.today}
          scopedProjectKeys={scopedProjectKeys ?? null}
        />
      ) : null}
    </div>
  );
}
