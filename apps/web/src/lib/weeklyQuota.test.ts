import {
  ProviderDriverKind,
  ProviderInstanceId,
  UsageLimitSourceId,
  type ServerProvider,
  type ServerProviderUsageLimits,
  type UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { resolveWeeklyQuota } from "./weeklyQuota";

const now = Date.parse("2026-10-25T12:00:00Z");
const checkedAt = "2026-10-25T11:59:00Z";
const weekly = {
  id: "secondary",
  kind: "weekly",
  label: "Weekly",
  usedPercent: 37.5,
  resetsAt: "2026-10-28T12:00:00Z",
} as const;
const limits: ServerProviderUsageLimits = { checkedAt, windows: [weekly] };
function provider(overrides: Partial<ServerProvider> = {}): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make("selected"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated", email: "selected@example.test", workspaceId: "personal" },
    checkedAt,
    models: [],
    slashCommands: [],
    skills: [],
    usageLimits: limits,
    ...overrides,
  };
}
const source = (usageLimits = limits) => ({
  id: UsageLimitSourceId.make("hub"),
  kind: "cliproxy" as const,
  label: "Hub",
  checkedAt,
  accounts: [
    {
      id: "selected-account",
      driver: ProviderDriverKind.make("codex"),
      email: "SELECTED@example.test",
      workspaceId: "personal",
      usageLimits,
    },
  ],
});
const resolve = (
  selected: ServerProvider | null,
  sources: UsageLimitSourceSnapshots = [source()],
  model = "gpt-6.1-sol",
) => resolveWeeklyQuota({ provider: selected, sources, model, now });

describe("selected weekly quota", () => {
  it("shows rounded remaining quota and reset provenance for the selected account", () => {
    expect(resolve(provider())).toMatchObject({
      remainingPercent: 63,
      checkedAt,
      window: weekly,
      reason: null,
    });
    expect(
      resolve(
        provider({ usageLimits: { ...limits, windows: [{ ...weekly, usedPercent: 100 }] } }),
        [],
      )?.remainingPercent,
    ).toBe(0);
    expect(
      resolve(
        provider({ usageLimits: { ...limits, windows: [{ ...weekly, usedPercent: 0 }] } }),
        [],
      )?.remainingPercent,
    ).toBe(100);
  });

  it("never substitutes another account, workspace or an unknown login", () => {
    const missing = provider({ usageLimits: undefined });
    expect(
      resolve(missing, [
        { ...source(), accounts: [{ ...source().accounts[0]!, email: "other@example.test" }] },
      ])?.remainingPercent,
    ).toBeNull();
    expect(
      resolve(missing, [
        { ...source(), accounts: [{ ...source().accounts[0]!, workspaceId: "business" }] },
      ])?.remainingPercent,
    ).toBeNull();
    expect(
      resolve(provider({ usageLimits: undefined, auth: { status: "authenticated" } }))
        ?.remainingPercent,
    ).toBeNull();
    expect(resolve(missing)?.remainingPercent).toBe(63);
    expect(resolve(null)).toBeNull();
  });

  it("uses the newest matching snapshot and rejects stale, failed and expired readings", () => {
    expect(
      resolve(
        provider({
          usageLimits: {
            ...limits,
            checkedAt: "2026-10-25T11:58:00Z",
            windows: [{ ...weekly, usedPercent: 80 }],
          },
        }),
      )?.remainingPercent,
    ).toBe(63);
    for (const snapshot of [
      { ...limits, checkedAt: "2026-10-25T11:00:00Z" },
      { ...limits, unavailable: { reason: "probeFailed" as const } },
      { ...limits, windows: [{ ...weekly, resetsAt: "2026-10-25T11:59:30Z" }] },
      { ...limits, checkedAt: "2026-10-25T12:01:00Z" },
    ])
      expect(resolve(provider({ usageLimits: snapshot }), [])?.remainingPercent).toBeNull();
    expect(
      resolve(provider({ usageLimits: undefined }), [{ ...source(), error: "Probe failed" }])
        ?.remainingPercent,
    ).toBeNull();
  });

  it("does not infer a week from session, monthly, unknown or invalid values", () => {
    for (const window of [
      { ...weekly, kind: "monthly" as const },
      { ...weekly, kind: "session" as const },
      { ...weekly, usedPercent: Number.NaN },
      { ...weekly, usedPercent: 101 },
    ]) {
      expect(
        resolve(provider({ usageLimits: { ...limits, windows: [window] } }), [])?.remainingPercent,
      ).toBeNull();
    }
    expect(
      resolve(
        provider({ usageLimits: { ...limits, windows: [{ ...weekly, resetsAt: undefined }] } }),
        [],
      )?.remainingPercent,
    ).toBe(63);
  });

  it("uses the selected model's explicit weekly family and leaves ambiguous buckets unavailable", () => {
    const windows = [
      { ...weekly, id: "gemini-weekly", usedPercent: 20 },
      { ...weekly, id: "3p-weekly", usedPercent: 70 },
    ];
    const selected = provider({
      driver: ProviderDriverKind.make("antigravity"),
      usageLimits: { ...limits, windows },
    });
    expect(resolve(selected, [], "gemini-3.8-flash")?.remainingPercent).toBe(80);
    expect(resolve(selected, [], "claude-fable")?.remainingPercent).toBe(30);
    expect(resolve(selected, [], "unknown")?.remainingPercent).toBeNull();
    const claude = provider({
      driver: ProviderDriverKind.make("claudeAgent"),
      usageLimits: {
        ...limits,
        windows: [
          { ...weekly, id: "seven_day", usedPercent: 30 },
          { ...weekly, id: "seven_day_fable", usedPercent: 80 },
        ],
      },
    });
    expect(resolve(claude, [], "claude-fable-5")?.remainingPercent).toBe(20);
    expect(resolve(claude, [], "claude-opus-5")?.remainingPercent).toBe(70);
  });
});
