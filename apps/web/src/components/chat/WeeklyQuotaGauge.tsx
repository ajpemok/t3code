import type { EnvironmentId, ServerProvider, UsageLimitSourceSnapshots } from "@t3tools/contracts";
import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";
import type { LimitAccount } from "@t3tools/shared/usageLimits";
import { environmentPresentations } from "~/state/presentation";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";
import { cn } from "~/lib/utils";
import { UsageLimitDetails } from "../usage/UsageLimitDetails";
import { ResetCreditDialog, useResetCredit } from "../usage/UsageLimits";
import { useNowMinute } from "~/hooks/useNowMinute";
import { resolveWeeklyQuota } from "~/lib/weeklyQuota";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { composerFloatingLayerProps } from "./composerEventScope";

export function WeeklyQuotaGauge({
  environmentId,
  provider,
  sources,
  model,
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider | null;
  readonly sources: UsageLimitSourceSnapshots;
  readonly model: string;
}) {
  const minute = useNowMinute();
  const presentations = useAtomValue(environmentPresentations.presentationsWithProvidersAtom);
  const quota = resolveWeeklyQuota({
    environmentId,
    provider,
    sources,
    model,
    presentations,
    clockKey: minute,
  });
  if (!quota) return null;
  const redeemAt = quota.account?.redeem;
  return redeemAt ? (
    <RedeemableWeeklyGauge
      key={`${quota.accountIdentity}:${JSON.stringify(redeemAt)}`}
      quota={quota}
      redeemAt={redeemAt}
    />
  ) : (
    <WeeklyQuotaControl quota={quota} redeem={null} />
  );
}

type WeeklyQuota = NonNullable<ReturnType<typeof resolveWeeklyQuota>>;

function RedeemableWeeklyGauge({
  quota,
  redeemAt,
}: {
  readonly quota: WeeklyQuota;
  readonly redeemAt: NonNullable<LimitAccount["redeem"]>;
}) {
  const redeem = useResetCredit(redeemAt.environmentId, redeemAt.input);
  return (
    <>
      <WeeklyQuotaControl quota={quota} redeem={redeem} />
      <ResetCreditDialog
        open={redeem.confirming}
        onOpenChange={redeem.setConfirming}
        onConfirm={() => void redeem.redeem()}
        disabled={!redeem.canManageProviders}
      />
      {redeem.busy || redeem.status ? (
        <span role="status" className="sr-only">
          {redeem.busy ? "Using reset credit…" : redeem.status}
        </span>
      ) : null}
    </>
  );
}

function WeeklyQuotaControl({
  quota,
  redeem,
}: {
  readonly quota: WeeklyQuota;
  readonly redeem: ReturnType<typeof useResetCredit> | null;
}) {
  const [open, setOpen] = useState(false);
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
  const credits = quota.account?.limits.resetCredits?.availableCount ?? 0;
  const accessibleLabel = `${label}${credits > 0 ? `, ${credits} reset credits banked` : ""}${quota.resetAttention ? `, ${quota.resetAttention === "important" ? "important: expires within 24 hours" : "needs attention: expires within 48 hours"}` : ""}`;
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          openOnHover
          delay={150}
          render={
            <Button size="xs" variant="ghost-muted" aria-label={accessibleLabel}>
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
              <span data-composer-usage-figure className="text-xs tabular-nums">
                {remaining === null ? "N/A" : `${remaining}%`}
              </span>
              {credits > 0 ? (
                <sup
                  ref={observeVisibleAnimation}
                  data-attention={quota.resetAttention ?? undefined}
                  aria-hidden
                  className={cn(
                    "weekly-reset-counter",
                    quota.resetAttention === "important"
                      ? "text-reset-important"
                      : quota.resetAttention === "attention"
                        ? "text-reset-attention"
                        : "text-secondary-label",
                  )}
                >
                  {credits}
                </sup>
              ) : null}
            </Button>
          }
        />
        <PopoverPopup {...composerFloatingLayerProps} side="top" align="end" initialFocus={false}>
          {quota.account && quota.window && remaining !== null ? (
            <UsageLimitDetails
              account={quota.account}
              window={quota.window}
              reset={quota.reset}
              now={quota.now}
              redeem={redeem}
              onRedeem={() => {
                setOpen(false);
                redeem?.setConfirming(true);
              }}
            />
          ) : (
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-medium">{quota.providerLabel}</span>
              <span className="text-secondary-label">
                {quota.reason ?? "Weekly quota unavailable"}
              </span>
            </div>
          )}
        </PopoverPopup>
      </Popover>
    </>
  );
}
