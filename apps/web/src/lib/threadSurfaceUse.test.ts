import { describe, expect, it } from "vite-plus/test";
import { RunId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import { resolveThreadSurfaceUse, SURFACE_USE } from "./threadSurfaceUse";

const runId = RunId.make("current");
const running = { runId, status: "running" as const, completedAt: null };

describe("resolveThreadSurfaceUse", () => {
  it("distinguishes computer, browser and T3 browser calls without treating ownership as activity", () => {
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
});
