import {
  isProviderAvailable,
  type ServerProvider,
  type ServerProviderUsageLimits,
  type ServerProviderUsageWindow,
  type UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";

// Provider probes can cache usage for five minutes; older snapshots are last-known readings.
const MAX_SNAPSHOT_AGE_MS = 5 * 60_000;

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
  provider,
  sources,
  model,
  now = Date.now(),
}: {
  readonly provider: ServerProvider | null;
  readonly sources: UsageLimitSourceSnapshots;
  readonly model: string;
  readonly now?: number;
  readonly clockKey?: string;
}) {
  if (!provider) return null;
  const snapshots: { limits: ServerProviderUsageLimits; sourceError?: string | undefined }[] = [];
  if (provider.usageLimits) snapshots.push({ limits: provider.usageLimits });
  const email = provider.auth.email?.trim().toLowerCase();
  const fingerprint = provider.usageLimits?.credentialFingerprint;
  for (const source of sources) {
    for (const account of source.accounts) {
      const sameLogin = email
        ? account.email?.trim().toLowerCase() === email
        : fingerprint !== undefined && account.usageLimits.credentialFingerprint === fingerprint;
      if (
        account.driver !== provider.driver ||
        !sameLogin ||
        account.workspaceId !== provider.auth.workspaceId
      )
        continue;
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
  return {
    remainingPercent: reason === null && window ? remainingPercent(window) : null,
    window,
    checkedAt,
    reason,
    providerLabel: provider.displayName?.trim() || String(provider.instanceId),
  };
}
