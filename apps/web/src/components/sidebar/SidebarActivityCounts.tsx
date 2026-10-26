import { GitForkIcon, MessagesSquareIcon } from "lucide-react";
import type { SidebarThreadSummary } from "~/types";
import { useNowMinute } from "~/hooks/useNowMinute";
import { sidebarActivityCounts } from "../Sidebar.logic";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function SidebarActivityCounts({
  threads,
  stacked = false,
}: {
  readonly threads: readonly SidebarThreadSummary[];
  readonly stacked?: boolean;
}) {
  const minute = useNowMinute();
  const counts = sidebarActivityCounts(threads, `${minute}:00.000Z`);
  return (
    <span
      className={`flex shrink-0 text-3xs tabular-nums ${stacked ? "flex-col items-end gap-0.5" : "items-center gap-2"}`}
    >
      {(
        [
          ["Threads", counts.threads, MessagesSquareIcon],
          ["Subagents", counts.subagents, GitForkIcon],
        ] as const
      ).map(([label, count, Icon]) => (
        <Tooltip key={label}>
          <TooltipTrigger
            render={
              <span
                className="inline-flex items-center gap-1"
                aria-label={`${label}: ${count.active} active, ${count.inactive} inactive`}
              />
            }
          >
            <Icon className="size-3 text-sidebar-muted-foreground" aria-hidden />
            <span className="font-medium text-sidebar-foreground">{count.active}</span>
            <span className="text-sidebar-muted-foreground">/ {count.inactive}</span>
          </TooltipTrigger>
          <TooltipPopup side="top">
            {label}: {count.active} active · {count.inactive} inactive
          </TooltipPopup>
        </Tooltip>
      ))}
    </span>
  );
}
