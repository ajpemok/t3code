import { describe, expect, it, vi } from "vite-plus/test";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { RunId, type PreviewSessionSnapshot } from "@t3tools/contracts";
import { readThreadPreviewState } from "~/previewStateStore";
import type { RightPanelSurface } from "~/rightPanelStore";
import { makeThreadFixture } from "~/test-fixtures";
import {
  closeInactivePanelTabs,
  inactivePanelSurfaces,
  type InactivePanelTab,
} from "./inactivePanelTabs";

const browser: RightPanelSurface = { id: "browser:tab", kind: "preview", resourceId: "tab" };
const file: RightPanelSurface = {
  id: "file:readme",
  kind: "file",
  relativePath: "README.md",
  revealLine: null,
  revealRequestId: 0,
};
const files: RightPanelSurface = { id: "files", kind: "files" };
const terminal: RightPanelSurface = {
  id: "terminal:shell",
  kind: "terminal",
  resourceId: "shell",
  terminalIds: ["shell"],
  activeTerminalId: "shell",
};

function setup() {
  const thread = makeThreadFixture();
  const threadRef = scopeThreadRef(thread.environmentId, thread.id);
  const snapshot: PreviewSessionSnapshot = {
    tabId: "tab",
    threadId: thread.id,
    navStatus: { _tag: "Idle" },
    canGoBack: false,
    canGoForward: false,
    updatedAt: "2026-10-25T01:00:00Z",
  };
  const input = {
    thread,
    panel: { isOpen: true, activeSurfaceId: file.id, surfaces: [browser, file, files, terminal] },
    preview: {
      ...readThreadPreviewState(threadRef),
      listLoaded: true,
      sessions: { tab: snapshot },
    },
    isSelectedThread: false,
    canClosePreview: true,
    busyBrowserIds: new Set<string>(),
    unsavedFilePaths: new Set<string>(),
  };
  const entry = (surface: RightPanelSurface): InactivePanelTab => ({
    threadRef,
    projectId: thread.projectId,
    surface,
  });
  return { input, snapshot, entry };
}

describe("inactivePanelSurfaces", () => {
  it("closes idle views after a provider run has finished", () => {
    const { input } = setup();
    const thread = makeThreadFixture({
      latestRun: {
        runId: RunId.make("finished"),
        status: "completed",
        requestedAt: input.thread.updatedAt,
        startedAt: input.thread.updatedAt,
        completedAt: input.thread.updatedAt,
        assistantMessageId: null,
      },
      runtime: {
        status: "idle",
        activeRunId: null,
        providerInstanceId: input.thread.providerInstanceId,
        providerName: "codex",
        lastError: null,
        updatedAt: input.thread.updatedAt,
      },
    });
    expect(inactivePanelSurfaces({ ...input, thread })).toEqual([browser, file, files]);
  });

  it("closes idle views and unclaimed browsers while retaining terminal sessions", () => {
    const { input } = setup();
    expect(inactivePanelSurfaces(input)).toEqual([browser, file, files]);
    expect(inactivePanelSurfaces({ ...input, isSelectedThread: true })).toEqual([browser, files]);
  });

  it("retains working threads, pending questions and approvals", () => {
    const { input } = setup();
    for (const thread of [
      { ...input.thread, hasPendingApprovals: true },
      { ...input.thread, hasPendingUserInput: true },
      { ...input.thread, isCompacting: true },
      { ...input.thread, pendingSubagentRequest: "user_input" as const },
      ...(["preparing", "queued", "starting", "running", "waiting"] as const).map((status) => ({
        ...input.thread,
        runtime: {
          status,
          activeRunId: RunId.make("active"),
          providerInstanceId: input.thread.providerInstanceId,
          providerName: null,
          lastError: null,
          updatedAt: input.thread.updatedAt,
        },
      })),
    ])
      expect(inactivePanelSurfaces({ ...input, thread })).toEqual([]);
  });

  it("retains controlled and recording browsers and browsers without close permission", () => {
    const { input, snapshot } = setup();
    const protectedInputs = [
      { ...input, canClosePreview: false },
      { ...input, busyBrowserIds: new Set(["tab"]) },
      {
        ...input,
        preview: {
          ...input.preview,
          sessions: { tab: { ...snapshot, automationOwner: "agent-owner" } },
        },
      },
      { ...input, preview: { ...input.preview, sessions: {}, listLoaded: false } },
    ];
    for (const state of protectedInputs)
      expect(inactivePanelSurfaces(state)).toEqual([file, files]);
  });

  it("keeps unsaved files and removes stale browser surfaces only after the list is known", () => {
    const { input } = setup();
    expect(inactivePanelSurfaces({ ...input, unsavedFilePaths: new Set(["README.md"]) })).toEqual([
      browser,
      files,
    ]);
    expect(
      inactivePanelSurfaces({ ...input, preview: { ...input.preview, sessions: {} } }),
    ).toEqual([browser, file, files]);
  });
});

describe("closeInactivePanelTabs", () => {
  it("awaits browser resource release before removing its panel tab", async () => {
    const { entry } = setup();
    const events: string[] = [];
    let finish!: (closed: boolean) => void;
    const pending = closeInactivePanelTabs({
      entries: [entry(browser), entry(file)],
      canClose: () => true,
      releaseBrowser: () => {
        events.push("release");
        return new Promise<boolean>((resolve) => {
          finish = resolve;
        });
      },
      closeSurface: ({ surface }) => events.push(surface.id),
    });
    expect(events).toEqual(["release"]);
    finish(true);
    expect(await pending).toEqual({ closed: 2, failed: 0 });
    expect(events).toEqual(["release", browser.id, file.id]);
  });

  it("keeps failed browser tabs visible and continues closing plain views", async () => {
    const { entry } = setup();
    const closeSurface = vi.fn();
    const result = await closeInactivePanelTabs({
      entries: [entry(browser), entry(file)],
      canClose: () => true,
      releaseBrowser: async () => false,
      closeSurface,
    });
    expect(result).toEqual({ closed: 1, failed: 1 });
    expect(closeSurface.mock.calls.map(([target]) => target.surface.id)).toEqual([file.id]);
  });

  it("rechecks each tab so work or user selection changed during a close is preserved", async () => {
    const { entry } = setup();
    let idle = true;
    const closeSurface = vi.fn();
    const result = await closeInactivePanelTabs({
      entries: [entry(browser), entry(file)],
      canClose: () => idle,
      releaseBrowser: async () => {
        idle = false;
        return true;
      },
      closeSurface,
    });
    expect(result).toEqual({ closed: 1, failed: 0 });
    expect(closeSurface.mock.calls.map(([target]) => target.surface.id)).toEqual([browser.id]);
  });

  it("retains the tab when releasing its resource rejects", async () => {
    const { entry } = setup();
    const closeSurface = vi.fn();
    expect(
      await closeInactivePanelTabs({
        entries: [entry(browser)],
        canClose: () => true,
        releaseBrowser: async () => {
          throw new Error("Unavailable");
        },
        closeSurface,
      }),
    ).toEqual({ closed: 0, failed: 1 });
    expect(closeSurface).not.toHaveBeenCalled();
  });
});
