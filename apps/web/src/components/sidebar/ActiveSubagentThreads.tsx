import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { GitForkIcon } from "lucide-react";
import { useClientSettings, updateClientSettings } from "~/hooks/useSettings";
import { environmentThreadShells } from "~/state/threads";
import { useCloseInactiveProjectTabs } from "~/hooks/useCloseInactiveProjectTabs";
import { useThreadRouteRef } from "~/hooks/useThreadRouteTarget";
import { buildThreadRouteParams } from "~/threadRoutes";
import type { SidebarThreadSummary } from "~/types";
import { activeSubagentsByParent, resolveThreadStatusPill } from "../Sidebar.logic";
import { ThreadActivityStatus } from "./ThreadSurfaceUseIndicator";
import { RelativeTime } from "../RelativeTime";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const activeSubagentsAtom = Atom.make((get) =>
  activeSubagentsByParent(get(environmentThreadShells.quietThreadShellsAtom)),
).pipe(Atom.setIdleTTL(0));

const activeChildrenAtom = Atom.family((key: string | null) => {
  let previous: readonly SidebarThreadSummary[] = [];
  return Atom.make((get) => {
    const next = key === null ? [] : (get(activeSubagentsAtom).get(key) ?? []);
    if (
      previous.length === next.length &&
      previous.every((thread, index) => thread === next[index])
    ) {
      return previous;
    }
    previous = next;
    return next;
  }).pipe(Atom.setIdleTTL(0));
});

export function ActiveSubagentsToggle() {
  const enabled = useClientSettings((settings) => settings.sidebarActiveSubagentsEnabled);
  const label = enabled ? "Hide active subagents" : "Show active subagents";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant={enabled ? "secondary" : "ghost-muted"}
            aria-label={label}
            aria-pressed={enabled}
            onClick={() => void updateClientSettings({ sidebarActiveSubagentsEnabled: !enabled })}
          />
        }
      >
        <GitForkIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}

export function ActiveSubagentThreads({
  threadRef,
  enabled,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly enabled: boolean;
}) {
  const show = useClientSettings((settings) => settings.sidebarActiveSubagentsEnabled);
  const key = show && enabled ? scopedThreadKey(threadRef) : null;
  const children = useAtomValue(activeChildrenAtom(key));
  const selected = useThreadRouteRef();
  const inactiveTabs = useCloseInactiveProjectTabs({
    threads: children,
    selectedThreadKey: selected ? scopedThreadKey(selected) : null,
  });
  if (children.length === 0) return null;
  return (
    <ul className="project-subagent-list" aria-label="Active subagents">
      {children.map((child) => {
        const ref = scopeThreadRef(child.environmentId, child.id);
        const childKey = scopedThreadKey(ref);
        const status = resolveThreadStatusPill({ thread: child });
        return (
          <li key={childKey}>
            <Link
              to="/$environmentId/$threadId"
              params={buildThreadRouteParams(ref)}
              className="flex min-h-7 min-w-0 items-center gap-1.5 px-2 text-xs text-sidebar-foreground/85 hover:bg-sidebar-row-hover focus-visible:outline-1 focus-visible:outline-ring"
              aria-label={`Open active subagent: ${child.title}`}
              title={child.title}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void inactiveTabs.showTaskContextMenu(ref, { x: event.clientX, y: event.clientY });
              }}
            >
              <GitForkIcon className="size-3 shrink-0 text-sidebar-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{child.title}</span>
              <span className="inline-flex shrink-0 flex-col items-end text-3xs leading-tight text-secondary-label">
                <ThreadActivityStatus
                  threadRef={ref}
                  enabled={enabled}
                  trackSurfaceUse={false}
                  status={status}
                />
                <RelativeTime
                  timestamp={child.latestUserMessageAt ?? child.updatedAt ?? child.createdAt}
                  nowLabel="now"
                />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
