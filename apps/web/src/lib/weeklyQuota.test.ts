import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  UsageLimitSourceId,
  type ServerProvider,
  type ServerProviderUsageLimits,
  type UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { resetCreditAttention, resolveWeeklyQuota } from "./weeklyQuota";

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
) =>
  resolveWeeklyQuota({
    environmentId: EnvironmentId.make("selected-environment"),
    provider: selected,
    sources,
    model,
    now,
  });

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

describe("banked reset credits", () => {
  it("uses the current provider snapshot when the composer reuses a provider with an older check time", () => {
    const selected = provider({ usageLimits: { ...limits, checkedAt: "2026-10-25T11:00:00Z" } });
    const local = EnvironmentId.make("local");
    const quota = resolveWeeklyQuota({
      environmentId: local,
      provider: selected,
      sources: [],
      model: "gpt-6.1-sol",
      now,
      presentations: new Map([
        [
          local,
          {
            entry: { target: { label: "Busan" } },
            serverConfig: { providers: [provider()] },
          },
        ],
      ]),
    });
    expect(quota?.remainingPercent).toBe(63);
    expect(quota?.checkedAt).toBe(checkedAt);
  });
  const credits = (hours: number, count = 2) => ({
    availableCount: count,
    nextExpiresAt: new Date(now + hours * 60 * 60_000).toISOString(),
    nextCreditId: "credit-next",
  });
  it("uses the freshest reported balance for the selected account, including zero", () => {
    const selected = provider({ usageLimits: { ...limits, resetCredits: credits(72) } });
    expect(resolve(selected, [])?.account?.limits.resetCredits?.availableCount).toBe(2);
    const hub = source({
      ...limits,
      checkedAt: "2026-10-25T11:59:30Z",
      resetCredits: credits(36, 0),
    });
    expect(resolve(selected, [hub])?.account?.limits.resetCredits?.availableCount).toBe(0);
    const otherAccount = {
      ...hub,
      accounts: [
        {
          ...hub.accounts[0]!,
          email: "other@example.test",
          usageLimits: { ...limits, resetCredits: credits(12, 9) },
        },
      ],
    };
    expect(resolve(selected, [otherAccount])?.account?.limits.resetCredits?.availableCount).toBe(2);
    const available = resolve(selected, [
      source({ ...limits, checkedAt: "2026-10-25T11:59:30Z", resetCredits: credits(36, 3) }),
    ]);
    expect(available?.account?.limits.resetCredits?.availableCount).toBe(3);
    expect(available?.account?.redeem?.input).toMatchObject({
      sourceId: "hub",
      accountId: "selected-account",
      creditId: "credit-next",
    });
  });
  it("does not display credits after their snapshot becomes stale or their next expiry passes", () => {
    const stale = provider({
      usageLimits: { ...limits, checkedAt: "2026-10-25T11:00:00Z", resetCredits: credits(12) },
    });
    expect(resolve(stale, [])?.account?.limits.resetCredits).toBeUndefined();
    const expired = provider({ usageLimits: { ...limits, resetCredits: credits(-1) } });
    expect(resolve(expired, [])?.account?.limits.resetCredits).toBeUndefined();
    expect(resolve(expired, [])?.remainingPercent).toBe(63);
  });
  it("distinguishes the 48-hour attention and 24-hour important boundaries", () => {
    expect(resetCreditAttention(credits(49), now)).toBeNull();
    expect(resetCreditAttention(credits(48), now)).toBe("attention");
    expect(resetCreditAttention(credits(25), now)).toBe("attention");
    expect(resetCreditAttention(credits(24), now)).toBe("important");
    expect(resetCreditAttention(credits(1), now)).toBe("important");
    expect(resetCreditAttention(credits(0), now)).toBeNull();
    expect(resetCreditAttention(credits(12, 0), now)).toBeNull();
    expect(resetCreditAttention({ availableCount: 2 }, now)).toBeNull();
  });
  it("shows the selected account's banked resets across environments without replacing its weekly window", () => {
    const selected = provider({ usageLimits: { ...limits, resetCredits: credits(72) } });
    const peer = EnvironmentId.make("peer");
    const quota = resolveWeeklyQuota({
      environmentId: EnvironmentId.make("local"),
      provider: selected,
      sources: [],
      model: "gpt-6.1-sol",
      now,
      presentations: new Map([
        [
          peer,
          {
            entry: { target: { label: "Seoul" } },
            serverConfig: {
              providers: [
                provider({
                  usageLimits: {
                    ...limits,
                    checkedAt: "2026-10-25T11:59:30Z",
                    windows: [{ ...weekly, usedPercent: 90 }],
                    resetCredits: credits(36, 3),
                  },
                }),
                provider({
                  instanceId: ProviderInstanceId.make("different-workspace"),
                  auth: { ...selected.auth, workspaceId: "other" },
                  usageLimits: {
                    ...limits,
                    checkedAt: "2026-10-25T11:59:40Z",
                    resetCredits: credits(12, 9),
                  },
                }),
              ],
            },
          },
        ],
      ]),
    });
    expect(quota?.remainingPercent).toBe(63);
    expect(quota?.account?.limits.resetCredits?.availableCount).toBe(3);
    expect(quota?.account?.environments.map((environment) => environment.label)).toContain("Seoul");
    expect(quota?.account?.redeem?.environmentId).toBe(peer);
    expect(quota?.resetAttention).toBe("attention");
  });
});
