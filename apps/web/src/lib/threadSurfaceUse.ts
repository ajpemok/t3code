import type { OrchestrationV2TurnItem, RunId } from "@t3tools/contracts";
import { dynamicToolSurface } from "@t3tools/shared/toolActivity";
import { resolveT3McpToolDefinition } from "@t3tools/shared/t3McpToolPresentation";

export const SURFACE_USE = { computer: 1, browser: 2, t3Browser: 4 } as const;

type ActivityItem = Pick<
  OrchestrationV2TurnItem,
  "status" | "runId" | "completedAt" | "toolSurface" | "toolSource" | "toolNonExecutionKind"
> & { readonly toolName?: string | null; readonly input?: unknown };

export function resolveThreadSurfaceUse(
  items: readonly ActivityItem[],
  runId: RunId | null,
): number {
  if (runId === null) return 0;
  let activity = 0;
  for (const item of items) {
    if (
      item.runId !== runId ||
      item.status !== "running" ||
      item.completedAt !== null ||
      item.toolNonExecutionKind
    )
      continue;
    const toolName = item.toolName?.replace(/^mcp__t3__/u, "mcp__t3_code__");
    if (resolveT3McpToolDefinition(toolName)?.summaryAction === "browser") {
      activity |= SURFACE_USE.t3Browser;
      continue;
    }
    const inferred = dynamicToolSurface(item.toolName, item.input);
    const surface =
      inferred === "browser" ? inferred : (item.toolSurface ?? inferred ?? item.toolSource?.kind);
    if (surface === "computer") activity |= SURFACE_USE.computer;
    if (surface === "browser") activity |= SURFACE_USE.browser;
  }
  return activity;
}
