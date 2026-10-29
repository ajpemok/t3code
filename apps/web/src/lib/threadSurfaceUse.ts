import type { OrchestrationV2TurnItem, RunId } from "@t3tools/contracts";
import { dynamicToolSurface } from "@t3tools/shared/toolActivity";
import { resolveT3McpToolDefinition } from "@t3tools/shared/t3McpToolPresentation";
import * as DateTime from "effect/DateTime";

export const SURFACE_USE = { computer: 1, browser: 2, t3Browser: 4, device: 8 } as const;
const RECENT_SURFACE_USE_MS = 5_000;

type ActivityItem = Pick<
  OrchestrationV2TurnItem,
  "status" | "runId" | "completedAt" | "toolSurface" | "toolSource" | "toolNonExecutionKind"
> & { readonly toolName?: string | null; readonly input?: unknown };

function itemSurface(item: ActivityItem): number {
  const toolName = item.toolName?.replace(/^mcp__t3__/u, "mcp__t3_code__");
  const action = resolveT3McpToolDefinition(toolName)?.summaryAction;
  if (action === "browser") return SURFACE_USE.t3Browser;
  if (action === "device") return SURFACE_USE.device;
  const inferred = dynamicToolSurface(item.toolName, item.input);
  const surface =
    inferred === "browser" ? inferred : (item.toolSurface ?? inferred ?? item.toolSource?.kind);
  return surface === "computer"
    ? SURFACE_USE.computer
    : surface === "browser"
      ? SURFACE_USE.browser
      : 0;
}

export function resolveThreadSurfaceUse(
  items: readonly ActivityItem[],
  runId: RunId | null,
  controlledT3Browser = false,
  deviceSession = false,
): number {
  if (runId === null) return 0;
  let activity =
    (controlledT3Browser ? SURFACE_USE.t3Browser : 0) | (deviceSession ? SURFACE_USE.device : 0);
  for (const item of items) {
    if (
      item.runId !== runId ||
      item.status !== "running" ||
      item.completedAt !== null ||
      item.toolNonExecutionKind
    )
      continue;
    activity |= itemSurface(item);
  }
  return activity;
}

export function recentThreadSurfaceUse(
  items: readonly ActivityItem[],
  runId: RunId | null,
  nowMs: number,
) {
  if (runId === null) return [];
  const expiries = new Map<number, number>();
  for (const item of items) {
    if (
      item.runId !== runId ||
      item.status !== "completed" ||
      !item.completedAt ||
      item.toolNonExecutionKind ||
      /(?:^|__)(?:preview_close|device_close)$/u.test(item.toolName ?? "")
    )
      continue;
    const expiresAt = DateTime.toEpochMillis(item.completedAt) + RECENT_SURFACE_USE_MS;
    if (expiresAt <= nowMs) continue;
    const surface = itemSurface(item);
    if (!surface) continue;
    expiries.set(surface, Math.max(expiries.get(surface) ?? 0, expiresAt));
  }
  return [...expiries].map(([surface, expiresAt]) => ({ surface, expiresAt }));
}
