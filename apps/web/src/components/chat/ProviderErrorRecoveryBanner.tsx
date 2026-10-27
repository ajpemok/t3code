import type { OrchestrationV2ProviderFailure, OrchestrationV2Run } from "@t3tools/contracts";
import {
  providerErrorRetryPlan,
  providerErrorRecoveryPlan,
} from "@t3tools/shared/orchestrationV2ThreadError";
import * as DateTime from "effect/DateTime";
import { RotateCwIcon } from "lucide-react";
import { useState } from "react";
import { useNowSecond } from "../../hooks/useNowSecond";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import type { ComposerBannerStackItem } from "./ComposerBannerStack";

type RecoveryProps = {
  readonly run: OrchestrationV2Run;
  readonly failure: OrchestrationV2ProviderFailure | null;
  readonly candidate: Parameters<typeof providerErrorRecoveryPlan>[0];
  readonly limit: number;
  readonly disabled: boolean;
  readonly onCancel: () => Promise<void>;
};

export function providerErrorRecoveryBannerItem(
  props: RecoveryProps,
): ComposerBannerStackItem | null {
  const stoppedAt = props.run.completedAt;
  if (
    !stoppedAt ||
    !providerErrorRetryPlan(
      props.run,
      props.failure,
      props.limit,
      DateTime.toEpochMillis(stoppedAt),
    )
  )
    return null;
  return {
    id: `provider-error-recovery:${props.run.id}`,
    variant: "warning",
    icon: <RotateCwIcon />,
    title: "Provider Retry",
    actions: <RecoveryControls key={props.run.id} {...props} />,
  };
}

function RecoveryControls(props: RecoveryProps) {
  const now = useNowSecond();
  const [pending, setPending] = useState(false);
  const plan = providerErrorRecoveryPlan(props.candidate, props.limit, now);
  if (!plan) return <span className="text-xs text-muted-foreground">Automatic retry paused</span>;
  const seconds = Math.max(0, Math.min(plan.delayMs / 1000, Math.ceil((plan.dueAt - now) / 1000)));
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        Retry {plan.attempt}/{props.limit}
        {seconds ? ` in ${seconds}s` : " pending"}
      </span>
      <Button
        size="xs"
        variant="ghost"
        disabled={pending || props.disabled}
        onClick={() => {
          setPending(true);
          void props
            .onCancel()
            .catch((cause: unknown) =>
              toastManager.add({
                type: "error",
                title: "Could not cancel retry",
                description: cause instanceof Error ? cause.message : "Try again.",
              }),
            )
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Cancelling…" : "Cancel retry"}
      </Button>
    </span>
  );
}
