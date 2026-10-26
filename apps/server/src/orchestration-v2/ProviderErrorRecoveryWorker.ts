import { CommandId, type OrchestrationV2Command } from "@t3tools/contracts";
import { providerErrorRecoveryPlan } from "@t3tools/shared/orchestrationV2ThreadError";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Scheduler from "../scheduling/Scheduler.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ProjectionStore from "./ProjectionStore.ts";
import * as ThreadManagement from "./ThreadManagementService.ts";

export function providerErrorRecoveryCommand(
  candidate: ProjectionStore.ProjectionProviderErrorRecoveryCandidate,
  limit: number,
  nowMs: number,
): OrchestrationV2Command | null {
  const plan = providerErrorRecoveryPlan(candidate, limit, nowMs);
  if (!plan || plan.dueAt > nowMs) return null;
  return {
    type: "message.dispatch",
    commandId: CommandId.make(`provider-error-retry:${candidate.run.id}`),
    threadId: candidate.thread.id,
    messageId: plan.messageId,
    providerErrorContinuationOfRunId: candidate.run.id,
    text: "Continue where you left off after the temporary provider error.",
    attachments: [],
    dispatchMode: { type: "start_immediately" },
    createdBy: "user",
    creationSource: "server",
  };
}

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const projections = yield* ProjectionStore.ProjectionStoreV2;
    const threads = yield* ThreadManagement.ThreadManagementService;
    const settings = yield* ServerSettings.ServerSettingsService;
    const scheduler = yield* Scheduler.Scheduler;
    const sweep = Effect.fn("ProviderErrorRecoveryWorker.sweep")(function* () {
      const preferences = yield* settings.getSettings;
      if (preferences.providerErrorRetryLimit === 0) return;
      const now = yield* DateTime.now;
      const candidates = yield* projections.getProviderErrorRecoveryCandidates(now);
      for (const candidate of candidates) {
        const command = providerErrorRecoveryCommand(
          candidate,
          preferences.providerErrorRetryLimit,
          DateTime.toEpochMillis(now),
        );
        if (command === null) continue;
        yield* threads.dispatch(command).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("Provider error continuation failed", {
              threadId: candidate.thread.id,
              cause,
            }),
          ),
        );
      }
    });
    yield* scheduler.register("provider-error-recovery", sweep());
  }),
);
