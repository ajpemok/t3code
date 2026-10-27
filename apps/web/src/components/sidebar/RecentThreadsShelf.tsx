import { Link } from "@tanstack/react-router";
import {
  scopeProjectRef,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import * as Schema from "effect/Schema";
import { GitForkIcon } from "lucide-react";
import { useRecentThreads } from "~/hooks/useRecentThreads";
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

function RecentRow({
  entry,
  onContextMenu,
}: {
  readonly entry: RecentThreadEntry;
  readonly onContextMenu: ReturnType<typeof useCloseInactiveProjectTabs>["showTaskContextMenu"];
}) {
  const { thread, finishedAt, parentTitle } = entry;
  const ref = scopeThreadRef(thread.environmentId, thread.id);
  const project = useProject(scopeProjectRef(thread.environmentId, thread.projectId));
  const subagent = isSidebarSubagentThread(thread);
  return (
    <li
      data-project-color={projectTintColor(project)}
      className={cn(
        "project-tint-row flex min-h-8 min-w-0 items-center gap-2 px-2 text-xs",
        subagent && "project-tint-subagent",
      )}
    >
      {subagent ? (
        <GitForkIcon
          aria-label="Subagent"
          className="size-3 shrink-0 text-sidebar-muted-foreground"
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
      <ThreadModelIdentity thread={thread} />
      <span className="shrink-0 text-3xs text-secondary-label">
        <RelativeTime timestamp={finishedAt} nowLabel="now" />
      </span>
    </li>
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
  const selected = useThreadRouteRef();
  const [expanded, setExpanded] = useLocalStorage(
    "t3code:sidebar:recent-expanded",
    true,
    Schema.Boolean,
  );
  const entries =
    scopedProjectKeys == null
      ? recent.entries
      : recent.entries.filter(({ thread }) =>
          scopedProjectKeys.has(`${thread.environmentId}:${thread.projectId}`),
        );
  const inactiveTabs = useCloseInactiveProjectTabs({
    threads: entries.map((entry) => entry.thread),
    selectedThreadKey: selected ? scopedThreadKey(selected) : null,
  });
  if (!recent.showSection) return null;
  return (
    <section aria-label="Recent" className={className}>
      <CollapsibleSectionHeader
        expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        tone="muted"
      >
        Recent ({entries.length})
      </CollapsibleSectionHeader>
      {expanded ? (
        <ul>
          {entries.map((entry) => (
            <RecentRow
              key={scopedThreadKey(scopeThreadRef(entry.thread.environmentId, entry.thread.id))}
              entry={entry}
              onContextMenu={inactiveTabs.showTaskContextMenu}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
