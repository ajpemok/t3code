import type { ScopedThreadRef } from "@t3tools/contracts";
import { threadRuntimeIsActive } from "@t3tools/client-runtime/state/models";
import type { SidebarThreadSummary } from "~/types";
import type { ThreadPreviewState } from "~/previewStateStore";
import type { RightPanelSurface, ThreadRightPanelState } from "~/rightPanelStore";

export interface InactivePanelTab {
  readonly threadRef: ScopedThreadRef;
  readonly projectId: SidebarThreadSummary["projectId"];
  readonly surface: RightPanelSurface;
}

export function inactivePanelSurfaces(input: {
  readonly thread: SidebarThreadSummary;
  readonly panel: ThreadRightPanelState;
  readonly preview: ThreadPreviewState;
  readonly isSelectedThread: boolean;
  readonly canClosePreview: boolean;
  readonly busyBrowserIds: ReadonlySet<string>;
  readonly unsavedFilePaths: ReadonlySet<string>;
}): readonly RightPanelSurface[] {
  const { thread, panel, preview } = input;
  if (
    threadRuntimeIsActive(thread.runtime) ||
    thread.runtime?.activeRunId != null ||
    thread.isCompacting ||
    thread.hasPendingApprovals ||
    thread.hasPendingUserInput ||
    thread.pendingSubagentRequest ||
    thread.pendingBackgroundTasks.length > 0
  )
    return [];
  return panel.surfaces.filter((surface) => {
    if (input.isSelectedThread && surface.id === panel.activeSurfaceId) return false;
    if (surface.kind === "terminal") return false;
    if (surface.kind === "file" && input.unsavedFilePaths.has(surface.relativePath)) return false;
    if (surface.kind !== "preview" || surface.resourceId === null) return true;
    if (!input.canClosePreview || input.busyBrowserIds.has(surface.resourceId)) return false;
    const snapshot = preview.sessions[surface.resourceId];
    const controller = preview.desktopByTabId[surface.resourceId]?.controller;
    return (
      (snapshot !== undefined || preview.listLoaded) &&
      !snapshot?.automationOwner &&
      controller !== "agent" &&
      controller !== "human"
    );
  });
}

export async function closeInactivePanelTabs(input: {
  readonly entries: readonly InactivePanelTab[];
  readonly canClose: (entry: InactivePanelTab) => boolean;
  readonly releaseBrowser: (entry: InactivePanelTab) => Promise<boolean>;
  readonly closeSurface: (entry: InactivePanelTab) => void;
}) {
  let closed = 0;
  let failed = 0;
  for (const entry of input.entries) {
    if (!input.canClose(entry)) continue;
    if (entry.surface.kind === "preview" && entry.surface.resourceId !== null) {
      let released = false;
      try {
        released = await input.releaseBrowser(entry);
      } catch {
        released = false;
      }
      if (!released) {
        failed += 1;
        continue;
      }
    }
    input.closeSurface(entry);
    closed += 1;
  }
  return { closed, failed };
}
