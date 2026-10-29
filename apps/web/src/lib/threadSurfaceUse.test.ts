import { describe, expect, it } from "vite-plus/test";
import { RunId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { recentThreadSurfaceUse, resolveThreadSurfaceUse, SURFACE_USE } from "./threadSurfaceUse";

const runId = RunId.make("current");
const running = { runId, status: "running" as const, completedAt: null };

describe("resolveThreadSurfaceUse", () => {
  it("distinguishes computer, browser and T3 browser calls and active browser control", () => {
    expect(resolveThreadSurfaceUse([{ ...running, toolSurface: "computer" }], runId)).toBe(
      SURFACE_USE.computer,
    );
    expect(resolveThreadSurfaceUse([{ ...running, toolSurface: "browser" }], runId)).toBe(
      SURFACE_USE.browser,
    );
    expect(
      resolveThreadSurfaceUse([{ ...running, toolName: "mcp__t3_code__preview_navigate" }], runId),
    ).toBe(SURFACE_USE.t3Browser);
    expect(
      resolveThreadSurfaceUse([{ ...running, toolName: "mcp__t3__preview_snapshot" }], runId),
    ).toBe(SURFACE_USE.t3Browser);
    expect(
      resolveThreadSurfaceUse([{ ...running, toolName: "mcp__t3_code__t3_thread_read" }], runId),
    ).toBe(0);
    expect(resolveThreadSurfaceUse([], runId, true)).toBe(SURFACE_USE.t3Browser);
    expect(
      resolveThreadSurfaceUse(
        [{ ...running, status: "completed", toolSurface: "browser" }],
        runId,
        true,
      ),
    ).toBe(SURFACE_USE.t3Browser);
    expect(resolveThreadSurfaceUse([], runId, false)).toBe(0);
    expect(resolveThreadSurfaceUse([], null, true)).toBe(0);
    expect(resolveThreadSurfaceUse([], runId, false, true)).toBe(SURFACE_USE.device);
    expect(resolveThreadSurfaceUse([], null, false, true)).toBe(0);
    expect(
      resolveThreadSurfaceUse([{ ...running, toolName: "mcp__t3__device_screenshot" }], runId),
    ).toBe(SURFACE_USE.device);
  });

  it("ignores completed, failed, waiting and previous-run calls", () => {
    for (const status of ["completed", "failed", "waiting", "pending", "cancelled"] as const) {
      expect(resolveThreadSurfaceUse([{ ...running, status, toolSurface: "browser" }], runId)).toBe(
        0,
      );
    }
    expect(
      resolveThreadSurfaceUse(
        [{ ...running, runId: RunId.make("old"), toolSurface: "browser" }],
        runId,
      ),
    ).toBe(0);
    const completedAt = DateTime.makeUnsafe("2026-10-25T01:00:00Z");
    const completed = { ...running, status: "completed" as const, completedAt };
    expect(
      recentThreadSurfaceUse(
        [
          { ...completed, toolSurface: "computer" },
          { ...completed, toolSurface: "browser" },
          { ...completed, toolName: "mcp__t3__preview_snapshot" },
          { ...completed, toolName: "mcp__t3__device_screenshot" },
          { ...completed, status: "failed", toolSurface: "browser" },
          { ...completed, runId: RunId.make("old"), toolSurface: "browser" },
        ],
        runId,
        DateTime.toEpochMillis(completedAt),
      ),
    ).toEqual(
      [1, 2, 4, 8].map((surface) => ({
        surface,
        expiresAt: DateTime.toEpochMillis(completedAt) + 5_000,
      })),
    );
    expect(
      recentThreadSurfaceUse(
        [
          { ...completed, toolName: "mcp__t3__preview_close" },
          { ...completed, toolName: "mcp__t3__device_close" },
        ],
        runId,
        DateTime.toEpochMillis(completedAt),
      ),
    ).toEqual([]);
    expect(
      recentThreadSurfaceUse(
        [{ ...completed, toolSurface: "browser" }],
        runId,
        DateTime.toEpochMillis(completedAt) + 5_000,
      ),
    ).toEqual([]);
    const newerAt = DateTime.makeUnsafe("2026-10-25T01:00:01Z");
    expect(
      recentThreadSurfaceUse(
        [
          { ...completed, completedAt: newerAt, toolSurface: "browser" },
          { ...completed, toolSurface: "browser" },
        ],
        runId,
        DateTime.toEpochMillis(completedAt),
      ),
    ).toEqual([
      { surface: SURFACE_USE.browser, expiresAt: DateTime.toEpochMillis(newerAt) + 5_000 },
    ]);
    expect(resolveThreadSurfaceUse([{ ...running, toolSurface: "browser" }], null)).toBe(0);
    expect(
      resolveThreadSurfaceUse(
        [
          {
            ...running,
            completedAt: DateTime.makeUnsafe("2026-10-25T01:00:00Z"),
            toolSurface: "browser",
          },
        ],
        runId,
      ),
    ).toBe(0);
    expect(
      resolveThreadSurfaceUse(
        [{ ...running, toolNonExecutionKind: "approval", toolSurface: "browser" }],
        runId,
      ),
    ).toBe(0);
  });

  it("uses the existing computer-use classifier and combines concurrent tools", () => {
    expect(
      resolveThreadSurfaceUse(
        [
          { ...running, toolName: "cua_repl.js" },
          { ...running, toolSurface: "browser" },
          { ...running, toolName: "mcp__t3_code__preview_snapshot" },
        ],
        runId,
      ),
    ).toBe(7);
    expect(
      resolveThreadSurfaceUse(
        [{ ...running, toolName: "js", input: { code: "const browser = 3" } }],
        runId,
      ),
    ).toBe(0);
  });

  it("refines generic computer metadata when CUA is explicitly driving the browser", () => {
    expect(
      resolveThreadSurfaceUse(
        [
          {
            ...running,
            toolName: "mcp__cua_repl__js",
            toolSurface: "computer",
            input: { code: "await compactTab.playwright.domSnapshot();" },
          },
        ],
        runId,
      ),
    ).toBe(SURFACE_USE.browser);
  });
});
