import type { ServerProvider, UsageLimitSourceSnapshots } from "@t3tools/contracts";
import { FuelIcon } from "lucide-react";
import { useNowMinute } from "~/hooks/useNowMinute";
import { resolveWeeklyQuota } from "~/lib/weeklyQuota";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { composerFloatingLayerProps } from "./composerEventScope";

export function WeeklyQuotaGauge({
  provider,
  sources,
  model,
}: {
  readonly provider: ServerProvider | null;
  readonly sources: UsageLimitSourceSnapshots;
  readonly model: string;
}) {
  const minute = useNowMinute();
  const quota = resolveWeeklyQuota({ provider, sources, model, clockKey: minute });
  if (!quota) return null;
  const remaining = quota.remainingPercent;
  const color =
    remaining === null
      ? "var(--color-muted-foreground)"
      : remaining <= 10
        ? "var(--color-error)"
        : remaining <= 25
          ? "var(--color-warning-foreground)"
          : "var(--color-success-foreground)";
  const label =
    remaining === null ? "Weekly quota unavailable" : `Weekly quota ${remaining}% remaining`;
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <Button size="xs" variant="ghost-muted" aria-label={label}>
            <svg viewBox="0 0 30 22" className="h-5 w-7" aria-hidden>
              <path
                d="M3 16a12 12 0 0 1 24 0"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                opacity="0.2"
              />
              {remaining !== null ? (
                <>
                  <path
                    d="M3 16a12 12 0 0 1 24 0"
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    pathLength="100"
                    strokeDasharray={`${remaining} 100`}
                  />
                  <path
                    d="M15 16V8"
                    stroke={color}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    transform={`rotate(${remaining * 1.8 - 90} 15 16)`}
                  />
                  <circle cx="15" cy="16" r="1.5" fill={color} />
                </>
              ) : (
                <path d="M12 14h6" stroke="currentColor" strokeWidth="1.5" />
              )}
              <path d="M3 20h2m20 0h2" stroke="currentColor" opacity="0.5" />
            </svg>
            <span className="text-xs tabular-nums">
              {remaining === null ? "N/A" : `${remaining}%`}
            </span>
            <span className="text-2xs text-secondary-label">wk</span>
          </Button>
        }
      />
      <PopoverPopup {...composerFloatingLayerProps} tooltipStyle side="top" align="end" width="sm">
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <FuelIcon className="size-3.5" />
            Weekly Remaining
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-secondary-label">{quota.providerLabel}</span>
            <span className="tabular-nums">
              {remaining === null ? "Unavailable" : `${remaining}%`}
            </span>
          </div>
          {quota.window ? <div className="text-secondary-label">{quota.window.label}</div> : null}
          {quota.reason ? <div className="text-secondary-label">{quota.reason}</div> : null}
          <div className="flex justify-between gap-3">
            <span className="text-secondary-label">Resets</span>
            <span>
              {quota.window?.resetsAt
                ? new Date(quota.window.resetsAt).toLocaleString()
                : "Not reported"}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-secondary-label">Checked</span>
            <span>
              {quota.checkedAt ? new Date(quota.checkedAt).toLocaleString() : "Not reported"}
            </span>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
