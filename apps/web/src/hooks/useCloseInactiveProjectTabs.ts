import { useRef, useState } from "react";
import {
  scopedThreadKey,
  scopeThreadRef,
  scopeProjectRef,
} from "@t3tools/client-runtime/environment";
import { AuthPreviewOperateScope, type ScopedThreadRef } from "@t3tools/contracts";
import { useBrowserSurfaceStore } from "~/browser/browserSurfaceStore";
import { previewRuntimeTabId } from "~/browser/previewRuntimeTabId";
import { getUnsavedProjectFileQueryData } from "~/components/files/projectFilesQueryState";
import { closePreviewSession } from "~/components/preview/closePreviewSession";
import { toastManager } from "~/components/ui/toast";
import {
  closeInactivePanelTabs,
  inactivePanelSurfaces,
  type InactivePanelTab,
} from "~/lib/inactivePanelTabs";
import { readThreadPreviewState } from "~/previewStateStore";
import {
  selectActiveRightPanelSurface,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "~/rightPanelStore";
import { readProject, readThreadShell } from "~/state/entities";
import { previewEnvironment } from "~/state/preview";
import { readEnvironmentScope } from "~/state/session";
import { useAtomCommand } from "~/state/use-atom-command";
import type { SidebarThreadSummary } from "~/types";
import { setActivePreviewTab } from "~/previewStateStore";
import { readLocalApi } from "~/localApi";
import { useStableCallback } from "./useStableCallback";

export function useCloseInactiveProjectTabs(input: {
  readonly threads: readonly SidebarThreadSummary[];
  readonly selectedThreadKey: string | null;
}) {
  const closePreview = useAtomCommand(previewEnvironment.close, { reportFailure: false });
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const targetsFor = (thread: SidebarThreadSummary): readonly InactivePanelTab[] => {
    const threadRef = scopeThreadRef(thread.environmentId, thread.id);
    const preview = readThreadPreviewState(threadRef);
    const panel = selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, threadRef);
    const activity = useBrowserSurfaceStore.getState().activityByTabId;
    const busyBrowserIds = new Set(
      Object.keys(preview.sessions).filter(
        (tabId) =>
          (activity[tabId] ?? 0) > 0 ||
          (activity[previewRuntimeTabId(threadRef, preview.serverEpoch, tabId)] ?? 0) > 0,
      ),
    );
    const project = readProject(scopeProjectRef(thread.environmentId, thread.projectId));
    const cwd = thread.worktreePath ?? project?.workspaceRoot;
    const unsavedFilePaths = new Set(
      panel.surfaces.flatMap((surface) =>
        surface.kind === "file" &&
        cwd &&
        getUnsavedProjectFileQueryData(thread.environmentId, cwd, surface.relativePath)
          ? [surface.relativePath]
          : [],
      ),
    );
    return inactivePanelSurfaces({
      thread,
      panel,
      preview,
      busyBrowserIds,
      unsavedFilePaths,
      isSelectedThread: scopedThreadKey(threadRef) === input.selectedThreadKey,
      canClosePreview: readEnvironmentScope(thread.environmentId, AuthPreviewOperateScope),
    }).map((surface) => ({ threadRef, projectId: thread.projectId, surface }));
  };
  const entries = useStableCallback((target?: ScopedThreadRef) =>
    input.threads.flatMap((thread) => {
      if (
        target &&
        (thread.environmentId !== target.environmentId || thread.id !== target.threadId)
      )
        return [];
      const current = readThreadShell(scopeThreadRef(thread.environmentId, thread.id));
      return current && current.projectId === thread.projectId ? targetsFor(current) : [];
    }),
  );
  const canClose = useStableCallback((entry: InactivePanelTab) => {
    const current = readThreadShell(entry.threadRef);
    return (
      current !== null &&
      current.projectId === entry.projectId &&
      targetsFor(current).some((candidate) => candidate.surface === entry.surface)
    );
  });
  const closeInactiveTabs = useStableCallback(async (target?: ScopedThreadRef) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      const result = await closeInactivePanelTabs({
        entries: entries(target),
        canClose,
        releaseBrowser: async ({ threadRef, surface }) => {
          if (surface.kind !== "preview" || surface.resourceId === null) return true;
          return (
            (
              await closePreviewSession({
                closePreview,
                threadRef,
                tabId: surface.resourceId,
                snapshot: readThreadPreviewState(threadRef).sessions[surface.resourceId] ?? null,
              })
            )._tag === "Success"
          );
        },
        closeSurface: ({ threadRef, surface }) => {
          useRightPanelStore.getState().closeSurface(threadRef, surface.id);
          const active = selectActiveRightPanelSurface(
            useRightPanelStore.getState().byThreadKey,
            threadRef,
          );
          if (active?.kind === "preview" && active.resourceId)
            setActivePreviewTab(threadRef, active.resourceId);
        },
      });
      toastManager.add({
        type: result.failed > 0 ? "warning" : "success",
        title: `Closed ${result.closed} inactive tabs`,
        ...(result.failed > 0
          ? {
              description: `${result.failed} browser sessions could not be closed. Their tabs remain open.`,
            }
          : {}),
      });
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  });
  const showTaskContextMenu = useStableCallback(
    async (target: ScopedThreadRef, position: { x: number; y: number }) => {
      const count = entries(target).length;
      const action = await readLocalApi()?.contextMenu.show(
        [
          {
            id: "close-inactive-tabs",
            label: `Close all inactive tabs (${count})`,
            disabled: pendingRef.current || count === 0,
          },
        ],
        position,
      );
      if (action === "close-inactive-tabs") await closeInactiveTabs(target);
    },
  );
  return {
    closeInactiveTabs,
    showTaskContextMenu,
    getInactiveTabCount: (target?: ScopedThreadRef) => entries(target).length,
    pending,
  };
}
