import { useAtomValue } from "@effect/atom-react";
import { parseScopedThreadKey, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { AsyncResult, Atom } from "effect/reactivity";
import {
  AlarmClockIcon,
  AppWindowIcon,
  MonitorIcon,
  MousePointer2Icon,
  SmartphoneIcon,
} from "lucide-react";
import braveLogo from "~/assets/brave.svg";
import {
  recentThreadSurfaceUse,
  retainedThreadSurfaceUse,
  resolveThreadSurfaceUse,
  SURFACE_USE,
} from "~/lib/threadSurfaceUse";
import { useDeadlinePassed } from "~/hooks/useDeadline";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";
import { environmentThreadDetails, environmentThreadShells } from "~/state/threads";
import { previewStateAtom } from "~/previewStateStore";
import { deviceEnvironment } from "~/state/device";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { SidebarThreadSummary } from "~/types";
import { ThreadModelBadge } from "./ThreadModelDetails";
import type { ThreadStatusPill } from "../Sidebar.logic";
import { usePreviewSession } from "../preview/usePreviewSession";

type TaskActivityKind =
  | "working"
  | "compacting"
  | "woke"
  | "waiting"
  | "computer"
  | "browser"
  | "t3-browser"
  | "device"
  | "attention";

export function TaskActivitySymbol({ kind }: { readonly kind: TaskActivityKind }) {
  return (
    <span
      ref={observeVisibleAnimation}
      className="task-activity-symbol"
      data-task-activity={kind}
      aria-hidden
    >
      {kind === "woke" ? (
        <AlarmClockIcon />
      ) : kind === "computer" ? (
        <>
          <MonitorIcon />
          <MousePointer2Icon className="task-activity-cursor" />
        </>
      ) : kind === "browser" ? (
        <img src={braveLogo} alt="" className="size-3.5" />
      ) : kind === "t3-browser" ? (
        <AppWindowIcon />
      ) : kind === "device" ? (
        <SmartphoneIcon />
      ) : null}
    </span>
  );
}

function SurfaceUseSymbol({
  kind,
  endsAt,
}: {
  readonly kind: TaskActivityKind;
  readonly endsAt?: number | undefined;
}) {
  const ending = useDeadlinePassed(endsAt === undefined ? null : endsAt - 450);
  return (
    <span
      ref={ending ? observeVisibleAnimation : undefined}
      className={`inline-flex ${ending ? "thread-surface-ending" : ""}`}
    >
      <TaskActivitySymbol kind={kind} />
    </span>
  );
}

export function ThreadActivityStatus({
  thread,
  threadRef,
  enabled,
  status,
  trackSurfaceUse = true,
  onAcknowledgeWoke,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly enabled: boolean;
  readonly thread: SidebarThreadSummary;
  readonly status: ThreadStatusPill | null;
  readonly trackSurfaceUse?: boolean;
  readonly onAcknowledgeWoke?: (() => void) | undefined;
}) {
  const { activity, primaryActivity, retainedOnly, recentOnly, recent } = useSurfaceUse(
    enabled && trackSurfaceUse ? scopedThreadKey(threadRef) : null,
  );
  const attention =
    status !== null &&
    ["Pending Approval", "Awaiting Input", "Guest Request", "Plan Ready", "Failed"].includes(
      status.label,
    );
  const compacting = status?.label === "Compacting";
  const woke = status?.label === "Woke";
  const tool =
    attention || compacting || woke
      ? null
      : primaryActivity & SURFACE_USE.computer
        ? { kind: "computer" as const, label: "Using Computer", bit: SURFACE_USE.computer }
        : primaryActivity & SURFACE_USE.t3Browser
          ? { kind: "t3-browser" as const, label: "Using T3 Browser", bit: SURFACE_USE.t3Browser }
          : primaryActivity & SURFACE_USE.browser
            ? { kind: "browser" as const, label: "Using Browser", bit: SURFACE_USE.browser }
            : primaryActivity & SURFACE_USE.device
              ? { kind: "device" as const, label: "Using Device", bit: SURFACE_USE.device }
              : null;
  const kind =
    tool?.kind ??
    (woke
      ? "woke"
      : compacting
        ? "compacting"
        : status?.label === "Waiting"
          ? "waiting"
          : attention
            ? "attention"
            : "working");
  const label = tool
    ? retainedOnly & tool.bit
      ? `${tool.label.replace("Using ", "")} Use This Turn`
      : recentOnly & tool.bit
        ? tool.label.replace("Using", "Recently Used")
        : tool.label
    : status?.label;
  const endsAt =
    tool && recentOnly & tool.bit
      ? recent.find((item) => item.surface === tool.bit)?.expiresAt
      : undefined;
  const presentation =
    !tool && (!status || status.label === "Completed") ? null : (
      <span
        key={endsAt ?? kind}
        role="img"
        aria-label={label}
        data-thread-activity={kind}
        data-thread-surface-use={tool ? activity : undefined}
        className={`inline-flex shrink-0 items-center text-3xs ${tool ? "text-info" : (status?.colorClass ?? "")}`}
      >
        <SurfaceUseSymbol kind={kind} endsAt={endsAt} />
      </span>
    );
  const indicator =
    woke && onAcknowledgeWoke ? (
      <button
        type="button"
        aria-label="Dismiss Woke notification"
        className="inline-flex cursor-pointer rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onAcknowledgeWoke();
        }}
      >
        {presentation}
      </button>
    ) : (
      presentation
    );
  return (
    <ThreadModelBadge thread={thread} trackRun={enabled && trackSurfaceUse} statusLabel={label}>
      {indicator}
    </ThreadModelBadge>
  );
}

const EMPTY_SURFACE_USE = {
  activity: 0,
  retained: 0,
  recent: recentThreadSurfaceUse([], null, 0),
  syncPreview: false,
};

const surfaceUseAtom = Atom.family((key: string | null) =>
  Atom.make((get) => {
    const ref = key === null ? null : parseScopedThreadKey(key);
    if (!ref) return EMPTY_SURFACE_USE;
    const thread = get(environmentThreadShells.threadShellAtom(ref));
    if (!thread || thread.runtime?.status !== "running") return EMPTY_SURFACE_USE;
    const preview = get(previewStateAtom(scopedThreadKey(ref)));
    const controlledT3Browser =
      preview.serverAgentControlledTabs.size > 0 ||
      preview.serverAgentControllers.size > 0 ||
      Object.entries(preview.desktopByTabId).some(
        ([tabId, state]) => preview.sessions[tabId] && state.controller === "agent",
      );
    const items = get(environmentThreadDetails.quietVisibleTurnItemsAtom(ref)).map(
      (entry) => entry.item,
    );
    const deviceState = get(
      deviceEnvironment.state({ environmentId: ref.environmentId, input: {} }),
    );
    const devices = AsyncResult.isSuccess(deviceState) ? deviceState.value : null;
    const deviceSession =
      (devices?.agentAccessEnabled &&
        devices.sessions.some(
          (session) =>
            session.threadId === ref.threadId &&
            (devices.hostStatuses[session.hostId]?.status ?? devices.hostStatus) === "ready",
        )) ||
      false;
    return {
      syncPreview: controlledT3Browser,
      activity: resolveThreadSurfaceUse(
        items,
        thread.runtime.activeRunId,
        controlledT3Browser,
        deviceSession,
      ),
      recent: recentThreadSurfaceUse(items, thread.runtime.activeRunId, Date.now()),
      retained: retainedThreadSurfaceUse(items, thread.runtime.activeRunId),
    };
  }).pipe(Atom.setIdleTTL(0)),
);

function useSurfaceUse(key: string | null) {
  const state = useAtomValue(surfaceUseAtom(key));
  usePreviewSession(state.syncPreview && key !== null ? parseScopedThreadKey(key) : null);
  const recent =
    useRecentSurface(state, SURFACE_USE.computer) |
    useRecentSurface(state, SURFACE_USE.browser) |
    useRecentSurface(state, SURFACE_USE.t3Browser) |
    useRecentSurface(state, SURFACE_USE.device);
  return {
    activity: state.activity | state.retained | recent,
    primaryActivity: state.activity || recent || state.retained,
    retainedOnly: state.retained & ~state.activity,
    recentOnly: recent & ~(state.activity | state.retained),
    recent: state.recent,
  };
}

function useRecentSurface(state: typeof EMPTY_SURFACE_USE, bit: number) {
  const expiresAt =
    (state.activity | state.retained) & bit
      ? null
      : (state.recent.find((item) => item.surface === bit)?.expiresAt ?? null);
  const expired = useDeadlinePassed(expiresAt);
  return expiresAt !== null && !expired ? bit : 0;
}

export function ThreadSurfaceUseIndicator({
  threadRef,
  enabled,
  workingFallback = false,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly enabled: boolean;
  readonly workingFallback?: boolean;
}) {
  const { primaryActivity, retainedOnly, recentOnly, recent } = useSurfaceUse(
    enabled ? scopedThreadKey(threadRef) : null,
  );
  const surface = [
    { bit: SURFACE_USE.t3Browser, kind: "t3-browser" as const, label: "Using T3 Browser" },
    { bit: SURFACE_USE.device, kind: "device" as const, label: "Using Device" },
    { bit: SURFACE_USE.browser, kind: "browser" as const, label: "Using Browser" },
    { bit: SURFACE_USE.computer, kind: "computer" as const, label: "Using Computer" },
  ].find(({ bit }) => primaryActivity & bit);
  if (!surface) return workingFallback ? <TaskActivitySymbol kind="working" /> : null;
  const { bit, kind, label } = surface;
  const description =
    retainedOnly & bit
      ? `${label.replace("Using ", "")} Use This Turn`
      : recentOnly & bit
        ? label.replace("Using", "Recently Used")
        : label;
  const endsAt =
    recentOnly & bit ? recent.find((item) => item.surface === bit)?.expiresAt : undefined;
  return (
    <span data-thread-surface-use className="inline-flex size-3.5 shrink-0 items-center text-info">
      <Tooltip key={`${bit}:${endsAt ?? "active"}`}>
        <TooltipTrigger render={<span aria-label={description} className="inline-flex" />}>
          <SurfaceUseSymbol kind={kind} endsAt={endsAt} />
        </TooltipTrigger>
        <TooltipPopup>{description}</TooltipPopup>
      </Tooltip>
    </span>
  );
}
