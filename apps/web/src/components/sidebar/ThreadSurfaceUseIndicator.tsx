import { useAtomValue } from "@effect/atom-react";
import { parseScopedThreadKey, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { AppWindowIcon, MonitorIcon, MousePointer2Icon } from "lucide-react";
import braveLogo from "~/assets/brave.svg";
import { resolveThreadSurfaceUse, SURFACE_USE } from "~/lib/threadSurfaceUse";
import { observeVisibleAnimation } from "~/lib/visibleAnimation";
import { environmentThreadDetails, environmentThreadShells } from "~/state/threads";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { ThreadStatusPill } from "../Sidebar.logic";

type TaskActivityKind = "working" | "waiting" | "computer" | "browser" | "t3-browser" | "attention";

export function TaskActivitySymbol({ kind }: { readonly kind: TaskActivityKind }) {
  return (
    <span
      ref={observeVisibleAnimation}
      className="task-activity-symbol"
      data-task-activity={kind}
      aria-hidden
    >
      {kind === "computer" ? (
        <>
          <MonitorIcon />
          <MousePointer2Icon className="task-activity-cursor" />
        </>
      ) : kind === "browser" ? (
        <img src={braveLogo} alt="" className="size-3.5" />
      ) : kind === "t3-browser" ? (
        <AppWindowIcon />
      ) : null}
    </span>
  );
}

export function ThreadActivityStatus({
  threadRef,
  enabled,
  status,
  trackSurfaceUse = true,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly enabled: boolean;
  readonly status: ThreadStatusPill | null;
  readonly trackSurfaceUse?: boolean;
}) {
  const activity = useAtomValue(
    surfaceUseAtom(enabled && trackSurfaceUse ? scopedThreadKey(threadRef) : null),
  );
  const attention =
    status !== null &&
    ["Pending Approval", "Awaiting Input", "Guest Request", "Plan Ready", "Failed"].includes(
      status.label,
    );
  const tool = attention
    ? null
    : activity & SURFACE_USE.computer
      ? { kind: "computer" as const, label: "Using Computer" }
      : activity & SURFACE_USE.t3Browser
        ? { kind: "t3-browser" as const, label: "Using T3 Browser" }
        : activity & SURFACE_USE.browser
          ? { kind: "browser" as const, label: "Using Browser" }
          : null;
  if (!tool && (!status || status.label === "Completed")) return null;
  const kind =
    tool?.kind ?? (status?.label === "Waiting" ? "waiting" : attention ? "attention" : "working");
  return (
    <span
      data-thread-surface-use={tool ? activity : undefined}
      className={`inline-flex shrink-0 items-center gap-1 text-3xs ${tool ? "text-info" : (status?.colorClass ?? "")}`}
    >
      <TaskActivitySymbol kind={kind} />
      <span>{tool?.label ?? status?.label}</span>
    </span>
  );
}

const surfaceUseAtom = Atom.family((key: string | null) =>
  Atom.make((get) => {
    const ref = key === null ? null : parseScopedThreadKey(key);
    if (!ref) return 0;
    const thread = get(environmentThreadShells.threadShellAtom(ref));
    if (!thread || thread.runtime?.status !== "running") return 0;
    return resolveThreadSurfaceUse(
      get(environmentThreadDetails.quietVisibleTurnItemsAtom(ref)).map((entry) => entry.item),
      thread.runtime.activeRunId,
    );
  }).pipe(Atom.setIdleTTL(0)),
);

export function ThreadSurfaceUseIndicator({
  threadRef,
  enabled,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly enabled: boolean;
}) {
  const activity = useAtomValue(surfaceUseAtom(enabled ? scopedThreadKey(threadRef) : null));
  if (activity === 0) return null;
  return (
    <span data-thread-surface-use className="inline-flex shrink-0 items-center gap-1 text-info">
      {[
        { bit: SURFACE_USE.computer, kind: "computer" as const, label: "Using computer" },
        { bit: SURFACE_USE.browser, kind: "browser" as const, label: "Using browser" },
        { bit: SURFACE_USE.t3Browser, kind: "t3-browser" as const, label: "Using T3 browser" },
      ].map(({ bit, kind, label }) =>
        activity & bit ? (
          <Tooltip key={bit}>
            <TooltipTrigger render={<span aria-label={label} className="inline-flex" />}>
              <TaskActivitySymbol kind={kind} />
            </TooltipTrigger>
            <TooltipPopup>{label}</TooltipPopup>
          </Tooltip>
        ) : null,
      )}
    </span>
  );
}
