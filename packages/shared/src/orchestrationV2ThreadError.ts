import type {
  OrchestrationV2ProviderFailure,
  OrchestrationV2Run,
  OrchestrationV2TurnItem,
  OrchestrationV2AppThread,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { MessageId } from "@t3tools/contracts";
import { modelSelectionsEqual } from "./model.ts";

export function providerErrorRecoveryPlan(
  input: {
    readonly thread: Pick<
      OrchestrationV2AppThread,
      | "archivedAt"
      | "deletedAt"
      | "settledOverride"
      | "snoozedUntil"
      | "providerInstanceId"
      | "modelSelection"
      | "providerErrorRetryCancelledRunId"
    >;
    readonly run: OrchestrationV2Run;
    readonly failure: OrchestrationV2ProviderFailure | null;
    readonly blocked: boolean;
  },
  limit: number,
  nowMs: number,
) {
  const { thread, run } = input;
  if (
    input.blocked ||
    thread.archivedAt !== null ||
    thread.deletedAt !== null ||
    thread.settledOverride === "settled" ||
    thread.providerErrorRetryCancelledRunId === run.id ||
    thread.providerInstanceId !== run.providerInstanceId ||
    !modelSelectionsEqual(thread.modelSelection, run.modelSelection) ||
    (thread.snoozedUntil != null && DateTime.toEpochMillis(thread.snoozedUntil) > nowMs)
  )
    return null;
  return providerErrorRetryPlan(run, input.failure, limit, nowMs);
}

export function isRecoverableProviderFailure(failure: OrchestrationV2ProviderFailure | null) {
  if (
    !failure ||
    failure.retryable === false ||
    (failure.class !== "provider_error" && failure.class !== "transport_error") ||
    /(?:^|[_: -])(?:400|401|403|404)(?:$|[_: -])|invalid_api_key|unauthori[sz]ed|authentication/iu.test(
      failure.code ?? "",
    )
  )
    return false;
  return (
    failure.retryable === true ||
    /(?:^|[_: -])(?:429|500|502|503|504|529)(?:$|[_: -])|overloaded|at_capacity|capacity_exceeded|temporarily_unavailable|service_unavailable|server_error|econnreset|etimedout/iu.test(
      failure.code ?? "",
    )
  );
}

export function providerErrorRetryPlan(
  run: Pick<OrchestrationV2Run, "id" | "status" | "userMessageId" | "completedAt">,
  failure: OrchestrationV2ProviderFailure | null,
  limit: number,
  nowMs: number,
) {
  if (run.status !== "failed" || run.completedAt === null || !isRecoverableProviderFailure(failure))
    return null;
  const stoppedAt = DateTime.toEpochMillis(run.completedAt);
  if (nowMs - stoppedAt > 10 * 60_000 || stoppedAt > nowMs + 999) return null;
  const previousAttempt = /^provider-error-retry:(\d+):/u.exec(run.userMessageId)?.[1];
  const attempt = previousAttempt === undefined ? 1 : Number(previousAttempt) + 1;
  if (attempt > limit || attempt > 5 || limit <= 0) return null;
  const delayMs = [10_000, 30_000, 60_000][Math.min(attempt - 1, 2)]!;
  return {
    attempt,
    delayMs,
    dueAt: stoppedAt + delayMs,
    messageId: MessageId.make(`provider-error-retry:${attempt}:${run.id}`),
  };
}

type ErrorTurnItem = Extract<OrchestrationV2TurnItem, { type: "error" }>;
/** Only error items are read, so callers may pass items stripped of other fields. */
type FailureScanTurnItem =
  | ErrorTurnItem
  | { readonly type: Exclude<OrchestrationV2TurnItem["type"], "error"> };

export function latestRootProviderFailure(
  run: OrchestrationV2Run | null,
  turnItems: ReadonlyArray<FailureScanTurnItem>,
): OrchestrationV2ProviderFailure | null {
  if (run?.status !== "failed") return null;
  let latest: ErrorTurnItem | null = null;
  for (const item of turnItems) {
    if (
      item.type !== "error" ||
      item.status !== "failed" ||
      item.runId !== run.id ||
      item.nodeId !== run.rootNodeId
    )
      continue;
    if (
      latest === null ||
      DateTime.toEpochMillis(item.updatedAt) > DateTime.toEpochMillis(latest.updatedAt) ||
      (DateTime.toEpochMillis(item.updatedAt) === DateTime.toEpochMillis(latest.updatedAt) &&
        (item.ordinal > latest.ordinal || (item.ordinal === latest.ordinal && item.id > latest.id)))
    ) {
      latest = item;
    }
  }
  return latest?.failure ?? null;
}

export function threadErrorSummary(
  failure: OrchestrationV2ProviderFailure | null,
  sessionError: string | null,
) {
  const currentFailure =
    sessionError !== null && sessionError !== failure?.message ? null : failure;
  return {
    usageLimitResetAt:
      currentFailure?.class === "usage_limit" ? (currentFailure.resetAt ?? null) : null,
    lastError: sessionError ?? failure?.message ?? null,
    lastErrorClass: currentFailure?.class ?? null,
    lastErrorCode: currentFailure?.code ?? null,
  };
}

export function latestExecutedRun(
  runs: ReadonlyArray<OrchestrationV2Run>,
): OrchestrationV2Run | null {
  let latest: OrchestrationV2Run | null = null;
  for (const run of runs) {
    if (run.status === "queued") continue;
    if (run.status === "cancelled" && run.startedAt === null) continue;
    if (latest === null || runRanAfter(run, latest)) latest = run;
  }
  return latest;
}

/** Held queues can execute out of ordinal order; unfinished runs count as latest. */
export function runRanAfter(
  run: Pick<OrchestrationV2Run, "ordinal" | "completedAt">,
  other: Pick<OrchestrationV2Run, "ordinal" | "completedAt">,
): boolean {
  const end = (candidate: typeof run) =>
    !candidate.completedAt
      ? Number.POSITIVE_INFINITY
      : DateTime.toEpochMillis(candidate.completedAt);
  return end(run) === end(other) ? run.ordinal > other.ordinal : end(run) > end(other);
}

export function usageLimitBlockedRun(
  runs: ReadonlyArray<OrchestrationV2Run>,
  turnItems: ReadonlyArray<FailureScanTurnItem>,
  sessionError: string | null,
): OrchestrationV2Run | null {
  const executed = latestExecutedRun(runs);
  if (executed?.status !== "failed") return null;
  const summary = threadErrorSummary(latestRootProviderFailure(executed, turnItems), sessionError);
  return summary.lastErrorClass === "usage_limit" ? executed : null;
}

/** Retains a limited run's outcome when higher-ordinal runs never started. */
export function usageLimitRunPresentedAsLatest(
  runs: ReadonlyArray<OrchestrationV2Run>,
  turnItems: ReadonlyArray<FailureScanTurnItem>,
  sessionError: string | null,
): OrchestrationV2Run | null {
  const blocked = usageLimitBlockedRun(runs, turnItems, sessionError);
  return blocked !== null && runs.some((run) => run.ordinal > blocked.ordinal) ? blocked : null;
}

export function latestUnheldRun(
  runs: ReadonlyArray<OrchestrationV2Run>,
): OrchestrationV2Run | null {
  let latest: OrchestrationV2Run | null = null;
  for (const run of runs) {
    if (run.status === "queued" && run.queueHeld === true) continue;
    if (latest === null || run.ordinal > latest.ordinal) latest = run;
  }
  return latest;
}
