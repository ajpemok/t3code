import { useRecentThreads } from "~/hooks/useRecentThreads";
import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { scopedThreadKey, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { resolveSidebarSubagentVisibility, type ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { EyeOffIcon, GitForkIcon, PinIcon } from "lucide-react";
import { useState } from "react";
import { useNowMinute } from "~/hooks/useNowMinute";
import { cn } from "~/lib/utils";
import { useClientSettings, updateClientSettings } from "~/hooks/useSettings";
import { environmentThreadShells } from "~/state/threads";
import { useCloseInactiveProjectTabs } from "~/hooks/useCloseInactiveProjectTabs";
import { useThreadRouteRef } from "~/hooks/useThreadRouteTarget";
import { buildThreadRouteParams } from "~/threadRoutes";
import type { SidebarThreadSummary } from "~/types";
import { subagentsByParent, resolveThreadStatusPill } from "../Sidebar.logic";
import { ThreadActivityStatus } from "./ThreadSurfaceUseIndicator";
import { RelativeTime } from "../RelativeTime";
import { RecentThreadDismissButton } from "./RecentThreadDismissButton";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "../ui/menu";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "../ui/number-field";

const subagentsAtom = Atom.family((mode: "show" | "active") =>
  Atom.make((get) =>
    subagentsByParent(get(environmentThreadShells.quietThreadShellsAtom), mode, {
      includeSnoozed: true,
    }),
  ).pipe(Atom.setIdleTTL(0)),
);

const activeChildrenAtom = Atom.family((key: string | null) => {
  let previous: readonly SidebarThreadSummary[] = [];
  return Atom.make((get) => {
    const mode = key?.startsWith("show:") ? "show" : "active";
    const next =
      key === null ? [] : (get(subagentsAtom("show")).get(key.slice(mode.length + 1)) ?? []);
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
  const mode = useClientSettings(resolveSidebarSubagentVisibility);
  const label = mode === "show" ? "Show" : "Hide";
  return (
    <Menu>
      <MenuTrigger
        render={
          <Button
            size="icon-xs"
            variant={mode !== "hide" ? "secondary" : "ghost-muted"}
            aria-label={`Subagents: ${label}`}
          />
        }
      >
        <GitForkIcon className="size-3.5" />
      </MenuTrigger>
      <MenuPopup align="end">
        <MenuGroup>
          <MenuGroupLabel>Subagents</MenuGroupLabel>
          <MenuRadioGroup
            value={mode}
            onValueChange={(value) => {
              if (value === "show" || value === "hide")
                void updateClientSettings({
                  sidebarSubagentVisibility: value,
                  sidebarActiveSubagentsEnabled: value !== "hide",
                });
            }}
          >
            <MenuRadioItem value="show">Show</MenuRadioItem>
            <MenuRadioItem value="hide">Hide</MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>
        <VisibleSubagentsMenuGroup />
      </MenuPopup>
    </Menu>
  );
}

function VisibleSubagentsMenuGroup() {
  const count = useClientSettings((settings) => settings.sidebarSubagentPreviewCount);
  return (
    <MenuGroup>
      <MenuGroupLabel>Visible subagents</MenuGroupLabel>
      <div className="px-2 py-1">
        <NumberField
          aria-label="Visible subagent count"
          min={1}
          max={15}
          step={1}
          size="sm"
          value={count ?? 3}
          onValueChange={(value) => {
            if (value !== null)
              void updateClientSettings({
                sidebarSubagentPreviewCount: Math.max(1, Math.min(15, Math.round(value))),
              });
          }}
        >
          <NumberFieldGroup>
            <NumberFieldDecrement aria-label="Decrease visible subagent count" />
            <NumberFieldInput
              aria-label="Visible subagent count"
              inputMode="numeric"
              onKeyDownCapture={(event) => event.stopPropagation()}
            />
            <NumberFieldIncrement aria-label="Increase visible subagent count" />
          </NumberFieldGroup>
        </NumberField>
      </div>
    </MenuGroup>
  );
}

export function PinnedThreadsToggle() {
  const enabled = useClientSettings((settings) => settings.sidebarPinnedOnlyEnabled);
  const label = enabled ? "Show All Threads" : "Show Pinned Threads Only";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant={enabled ? "secondary" : "ghost-muted"}
            aria-label={label}
            aria-pressed={enabled}
            onClick={() => void updateClientSettings({ sidebarPinnedOnlyEnabled: !enabled })}
          />
        }
      >
        <PinIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipPopup side="top">{label}</TooltipPopup>
    </Tooltip>
  );
}

export function InactiveThreadsToggle() {
  const enabled = useClientSettings((settings) => settings.sidebarHideInactiveEnabled);
  const label = enabled
    ? "Show Inactive Threads and Projects"
    : "Hide Inactive Threads and Projects";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            size="icon-xs"
            variant={enabled ? "secondary" : "ghost-muted"}
            aria-label={label}
            aria-pressed={enabled}
            onClick={() => void updateClientSettings({ sidebarHideInactiveEnabled: !enabled })}
          />
        }
      >
        <EyeOffIcon className="size-3.5" />
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
  const requestedMode = useClientSettings(resolveSidebarSubagentVisibility);
  const hideInactive = useClientSettings((settings) => settings.sidebarHideInactiveEnabled);
  const mode = requestedMode === "show" && hideInactive ? "active" : requestedMode;
  const count = useClientSettings((settings) => settings.sidebarSubagentPreviewCount) ?? 3;
  const key = mode !== "hide" && enabled ? `${mode}:${scopedThreadKey(threadRef)}` : null;
  const minute = useNowMinute();
  const { retainedKeys, entries: recentEntries } = useRecentThreads(enabled && mode !== "hide");
  const candidates = useAtomValue(activeChildrenAtom(key));
  const children =
    subagentsByParent(candidates, mode === "active" ? "active" : "show", {
      now: `${minute}:00.000Z`,
      recentKeys: retainedKeys,
    }).get(scopedThreadKey(threadRef)) ?? [];
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const expansionKey = key === null ? null : `${count}:${key}`;
  const expanded = expansionKey !== null && expandedKey === expansionKey;
  const visibleChildren = expanded ? children : children.slice(0, count);
  const selected = useThreadRouteRef();
  const inactiveTabs = useCloseInactiveProjectTabs({
    threads: children,
    selectedThreadKey: selected ? scopedThreadKey(selected) : null,
  });
  if (children.length === 0) return null;
  return (
    <ul
      className="project-subagent-list"
      aria-label={
        mode === "active"
          ? children.some((child) =>
              retainedKeys.has(scopedThreadKey(scopeThreadRef(child.environmentId, child.id))),
            )
            ? "Active and recent subagents"
            : "Active subagents"
          : "Subagents"
      }
    >
      {visibleChildren.map((child) => {
        const ref = scopeThreadRef(child.environmentId, child.id);
        const childKey = scopedThreadKey(ref);
        const status = resolveThreadStatusPill({ thread: child });
        const recentEntry = recentEntries.find(
          (entry) =>
            entry.thread.environmentId === child.environmentId && entry.thread.id === child.id,
        );
        return (
          <li key={childKey}>
            <div
              className={cn(
                "project-tint-row project-tint-subagent group/recent relative flex min-h-7 min-w-0 items-center gap-1.5 px-2 text-xs text-sidebar-foreground/85",
                selected?.environmentId === ref.environmentId &&
                  selected.threadId === ref.threadId &&
                  "project-tint-selected",
              )}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void inactiveTabs.showTaskContextMenu(ref, { x: event.clientX, y: event.clientY });
              }}
            >
              <Link
                to="/$environmentId/$threadId"
                params={buildThreadRouteParams(ref)}
                aria-label={`Open ${retainedKeys.has(childKey) ? "recent " : mode === "active" ? "active " : ""}subagent: ${child.title}`}
                title={child.title}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm py-1 text-inherit outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <GitForkIcon
                  className="size-3.5 shrink-0 text-sidebar-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{child.title}</span>
              </Link>
              {recentEntry ? <RecentThreadDismissButton entry={recentEntry} /> : null}
              <span className="inline-flex shrink-0 flex-col items-end justify-center gap-0.5 text-3xs leading-tight text-secondary-label">
                <ThreadActivityStatus
                  thread={child}
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
            </div>
          </li>
        );
      })}
      {children.length > count ? (
        <li>
          <Button
            size="xs"
            variant="ghost-muted"
            className="w-full"
            onClick={() => setExpandedKey(expanded ? null : expansionKey)}
          >
            {expanded
              ? "Show fewer subagents"
              : `Show ${children.length - count} more ${children.length - count === 1 ? "subagent" : "subagents"}`}
          </Button>
        </li>
      ) : null}
    </ul>
  );
}
