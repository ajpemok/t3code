import { useAtomValue } from "@effect/atom-react";
import { parseScopedThreadKey, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { Atom } from "effect/reactivity";
import { AppWindowIcon, Globe2Icon, MonitorIcon } from "lucide-react";
import { resolveThreadSurfaceUse, SURFACE_USE } from "~/lib/threadSurfaceUse";
import { environmentThreadDetails, environmentThreadShells } from "~/state/threads";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

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
        { bit: SURFACE_USE.computer, Icon: MonitorIcon, label: "Using computer" },
        { bit: SURFACE_USE.browser, Icon: Globe2Icon, label: "Using browser" },
        { bit: SURFACE_USE.t3Browser, Icon: AppWindowIcon, label: "Using T3 browser" },
      ].map(({ bit, Icon, label }) =>
        activity & bit ? (
          <Tooltip key={bit}>
            <TooltipTrigger render={<span aria-label={label} className="inline-flex" />}>
              <Icon aria-hidden className="size-3.5" />
            </TooltipTrigger>
            <TooltipPopup>{label}</TooltipPopup>
          </Tooltip>
        ) : null,
      )}
    </span>
  );
}
