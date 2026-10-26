import { describe, expect, it } from "vite-plus/test";
import { MessageId, RunId, type OrchestrationV2ProviderFailure } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import {
  isRecoverableProviderFailure,
  providerErrorRetryPlan,
} from "./orchestrationV2ThreadError.ts";

const now = DateTime.makeUnsafe("2026-10-26T08:00:00Z");
const nowMs = DateTime.toEpochMillis(now);
const source = {
  id: RunId.make("failed-run"),
  status: "failed" as const,
  userMessageId: MessageId.make("original"),
  completedAt: now,
};
const failure: OrchestrationV2ProviderFailure = {
  class: "provider_error",
  code: "api_error_529",
  message: "Capacity unavailable",
  retryable: true,
};

describe("provider error recovery", () => {
  it("limits a durable continuation chain with increasing delays and stable identities", () => {
    const first = providerErrorRetryPlan(source, failure, 3, nowMs)!;
    expect(first.dueAt).toBe(nowMs + 10_000);
    expect(first).toEqual(providerErrorRetryPlan(source, failure, 3, nowMs + 5_000));
    const second = providerErrorRetryPlan(
      { ...source, id: RunId.make("second"), userMessageId: first.messageId },
      failure,
      3,
      nowMs,
    )!;
    expect(second.attempt).toBe(2);
    expect(second.dueAt).toBe(nowMs + 30_000);
    const third = providerErrorRetryPlan(
      { ...source, userMessageId: second.messageId },
      failure,
      3,
      nowMs,
    )!;
    expect(third.attempt).toBe(3);
    expect(third.dueAt).toBe(nowMs + 60_000);
    expect(
      providerErrorRetryPlan({ ...source, userMessageId: third.messageId }, failure, 3, nowMs),
    ).toBeNull();
    expect(providerErrorRetryPlan(source, failure, 0, nowMs)).toBeNull();
  });

  it("excludes old failures, unfinished runs and permanent failures", () => {
    expect(providerErrorRetryPlan(source, failure, 3, nowMs + 600_001)).toBeNull();
    expect(providerErrorRetryPlan(source, failure, 3, nowMs - 500)?.dueAt).toBe(nowMs + 10_000);
    expect(providerErrorRetryPlan(source, failure, 3, nowMs - 1_000)).toBeNull();
    expect(providerErrorRetryPlan({ ...source, completedAt: null }, failure, 3, nowMs)).toBeNull();
    expect(providerErrorRetryPlan({ ...source, status: "running" }, failure, 3, nowMs)).toBeNull();
    for (const className of [
      "usage_limit",
      "permission_error",
      "validation_error",
      "unknown",
    ] as const)
      expect(isRecoverableProviderFailure({ ...failure, class: className })).toBe(false);
    for (const code of ["api_error_401", "invalid_api_key", "unauthorized"])
      expect(isRecoverableProviderFailure({ ...failure, code })).toBe(false);
    expect(isRecoverableProviderFailure({ ...failure, retryable: false })).toBe(false);
    expect(
      isRecoverableProviderFailure({ ...failure, retryable: null, code: "api_error_503" }),
    ).toBe(true);
    expect(isRecoverableProviderFailure({ ...failure, retryable: null, code: "unknown" })).toBe(
      false,
    );
    expect(
      isRecoverableProviderFailure({
        ...failure,
        class: "transport_error",
        retryable: null,
        code: "ECONNRESET",
      }),
    ).toBe(true);
  });
});
