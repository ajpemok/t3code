import {
  isProviderAvailable,
  type EnvironmentId,
  type ServerProviderResetCredits,
  type ServerProvider,
  type ServerProviderUsageLimits,
  type ServerProviderUsageWindow,
  type UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import {
  collectLimitAccounts,
  collectLimitPools,
  remainingPercent,
  type LimitPresentations,
} from "@t3tools/shared/usageLimits";

// Provider probes can cache usage for five minutes; older snapshots are last-known readings.
const MAX_SNAPSHOT_AGE_MS = 5 * 60_000;

function freshCredits(limits: ServerProviderUsageLimits, now: number) {
  const checked = Date.parse(limits.checkedAt);
  const expires = Date.parse(limits.resetCredits?.nextExpiresAt ?? "");
  return {
    ...limits,
    resetCredits:
      !limits.unavailable &&
      Number.isFinite(checked) &&
      checked <= now &&
      now - checked <= MAX_SNAPSHOT_AGE_MS &&
      (!Number.isFinite(expires) || expires > now)
        ? limits.resetCredits
        : undefined,
  };
}

export function resetCreditAttention(credits: ServerProviderResetCredits | undefined, now: number) {
  if (!credits || credits.availableCount <= 0 || !credits.nextExpiresAt) return null;
  const left = Date.parse(credits.nextExpiresAt) - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  return left <= 24 * 60 * 60_000 ? "important" : left <= 48 * 60 * 60_000 ? "attention" : null;
}

function modelWindows(
  windows: readonly ServerProviderUsageWindow[],
  driver: string,
  model: string,
) {
  const weekly = windows.filter((window) => window.kind === "weekly");
  if (driver === "claudeAgent") {
    const specific = weekly.filter(
      (window) =>
        window.id.startsWith("seven_day_") &&
        model
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .includes(window.id.slice("seven_day_".length)),
    );
    return [...weekly.filter((window) => window.id === "seven_day"), ...specific];
  }
  if (driver === "antigravity") {
    const family = model.startsWith("gemini-")
      ? "gemini"
      : model.startsWith("claude-")
        ? "claude"
        : model.startsWith("gpt-")
          ? "gpt"
          : null;
    return family === null
      ? []
      : weekly.filter(
          (window) =>
            window.id.startsWith(`${family}-`) ||
            (family !== "gemini" && window.id.startsWith("3p-")),
        );
  }
  return weekly.length === 1 ? weekly : [];
}

export function resolveWeeklyQuota({
  environmentId,
  provider: selectedProvider,
  sources,
  model,
  presentations = new Map(),
  now = Date.now(),
}: {
  readonly environmentId: EnvironmentId;
  readonly provider: ServerProvider | null;
  readonly sources: UsageLimitSourceSnapshots;
  readonly model: string;
  readonly now?: number;
  readonly clockKey?: string;
  readonly presentations?: LimitPresentations;
}) {
  const currentConfig = presentations.get(environmentId)?.serverConfig;
  const provider = currentConfig
    ? currentConfig.providers.find(
        (candidate) => candidate.instanceId === selectedProvider?.instanceId,
      )
    : selectedProvider;
  if (!provider) return null;
  const snapshots: { limits: ServerProviderUsageLimits; sourceError?: string | undefined }[] = [];
  if (provider.usageLimits) snapshots.push({ limits: provider.usageLimits });
  const email = provider.auth.email?.trim().toLowerCase();
  const fingerprint = provider.usageLimits?.credentialFingerprint;
  const matches = (account: {
    driver: ServerProvider["driver"];
    email?: string | undefined;
    workspaceId?: string | undefined;
    usageLimits?: ServerProviderUsageLimits | undefined;
  }) =>
    account.driver === provider.driver &&
    account.workspaceId === provider.auth.workspaceId &&
    (email
      ? account.email?.trim().toLowerCase() === email
      : fingerprint !== undefined && account.usageLimits?.credentialFingerprint === fingerprint);
  for (const source of sources) {
    for (const account of source.accounts) {
      if (!matches(account)) continue;
      snapshots.push({ limits: account.usageLimits, sourceError: source.error });
    }
  }
  const snapshot = snapshots.sort(
    (a, b) => Date.parse(b.limits.checkedAt) - Date.parse(a.limits.checkedAt),
  )[0];
  const limits = snapshot?.limits;
  const candidates = modelWindows(limits?.windows ?? [], provider.driver, model);
  const window = candidates.sort((a, b) => b.usedPercent - a.usedPercent)[0] ?? null;
  const checkedAt = limits?.checkedAt ?? null;
  const checkedMs = Date.parse(checkedAt ?? "");
  const resetMs = Date.parse(window?.resetsAt ?? "");
  const reason =
    !provider.enabled || !provider.installed || !isProviderAvailable(provider)
      ? "Provider unavailable"
      : (snapshot?.sourceError ??
        limits?.unavailable?.message ??
        (limits?.unavailable ? "Usage snapshot unavailable" : null) ??
        (!window ? "No weekly quota reported for this model" : null) ??
        (!Number.isFinite(window?.usedPercent) ||
        window!.usedPercent < 0 ||
        window!.usedPercent > 100
          ? "Invalid weekly quota"
          : null) ??
        (!Number.isFinite(checkedMs) || checkedMs > now || now - checkedMs > MAX_SNAPSHOT_AGE_MS
          ? "Usage snapshot is out of date"
          : null) ??
        (window?.resetsAt && (!Number.isFinite(resetMs) || resetMs <= now)
          ? "Awaiting a quota update after reset"
          : null));
  const connected = new Map(presentations);
  connected.set(environmentId, {
    entry: presentations.get(environmentId)?.entry ?? { target: { label: "Current Environment" } },
    serverConfig: { providers: [provider], usageLimitSources: sources },
  });
  const filtered: LimitPresentations = new Map(
    [...connected].map(([id, presentation]) => [
      id,
      {
        entry: presentation.entry,
        serverConfig: {
          providers: (presentation.serverConfig?.providers ?? [])
            .filter(
              (candidate) =>
                (id === environmentId && candidate.instanceId === provider.instanceId) ||
                matches({
                  driver: candidate.driver,
                  email: candidate.auth.email,
                  workspaceId: candidate.auth.workspaceId,
                  usageLimits: candidate.usageLimits,
                }),
            )
            .map((candidate) => ({
              ...candidate,
              ...(candidate.usageLimits
                ? { usageLimits: freshCredits(candidate.usageLimits, now) }
                : {}),
            })),
          usageLimitSources: (presentation.serverConfig?.usageLimitSources ?? [])
            .filter((source) => !source.error)
            .map((source) => ({
              ...source,
              accounts: source.accounts.filter(matches).map((account) => ({
                ...account,
                usageLimits: freshCredits(account.usageLimits, now),
              })),
            })),
        },
      },
    ]),
  );
  const reported = collectLimitAccounts(filtered)[0];
  const account =
    reported && limits
      ? {
          ...reported,
          displayName: provider.displayName?.trim() || null,
          limits: {
            ...limits,
            resetCredits: reason === null ? reported.limits.resetCredits : undefined,
          },
        }
      : null;
  const reset =
    account && window
      ? collectLimitPools([account], now)
          .flatMap((pool) => pool.windows)
          .find(
            (candidate) =>
              candidate.kind === window.kind &&
              candidate.members.some((member) => member.window.id === window.id),
          )?.resets[0]
      : undefined;
  return {
    accountIdentity: JSON.stringify([
      provider.instanceId,
      provider.driver,
      email,
      provider.auth.workspaceId,
      provider.usageLimits?.credentialFingerprint,
    ]),
    remainingPercent: reason === null && window ? remainingPercent(window) : null,
    window,
    checkedAt,
    reason,
    providerLabel: provider.displayName?.trim() || String(provider.instanceId),
    account,
    reset,
    now,
    resetAttention: resetCreditAttention(account?.limits.resetCredits, now),
  };
}
