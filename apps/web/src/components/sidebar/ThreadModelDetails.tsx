import { useAtomValue } from "@effect/atom-react";
import {
  parseScopedThreadKey,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import { Atom } from "effect/reactivity";
import { useState, type ReactNode } from "react";
import { providersIgnoringCheckedAtAtom } from "~/state/server";
import { environmentThreadDetails } from "~/state/threads";
import type { SidebarThreadSummary } from "~/types";
import { ThreadHoverCard, ThreadHoverCardPopup } from "../ThreadHoverCard";
import { Tooltip, TooltipTrigger } from "../ui/tooltip";
import { sidebarExecutionModel, sidebarModelDetails } from "./threadModelDetails.logic";

const projectionAtom = Atom.family((key: string | null) =>
  Atom.make((get) => {
    const ref = key === null ? null : parseScopedThreadKey(key);
    return ref ? (get(environmentThreadDetails.quietThreadAtom(ref))?.projection ?? null) : null;
  }).pipe(Atom.setIdleTTL(0)),
);

function useModelDetails(thread: SidebarThreadSummary, readRun: boolean) {
  const providers = useAtomValue(providersIgnoringCheckedAtAtom(thread.environmentId));
  const projection = useAtomValue(
    projectionAtom(
      readRun ? scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id)) : null,
    ),
  );
  const { selection, source } = sidebarExecutionModel(thread, projection);
  return {
    ...sidebarModelDetails(
      selection,
      providers.find((provider) => provider.instanceId === selection.instanceId),
    ),
    source,
  };
}

function ModelFields({ details }: { readonly details: ReturnType<typeof useModelDetails> }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5">
      <dt>{details.source === "selected" ? "Thread Model" : "Run Model"}</dt>
      <dd className="min-w-0 wrap-break-word text-foreground">{details.modelName}</dd>
      <dt>Provider</dt>
      <dd className="min-w-0 wrap-break-word">{details.providerName}</dd>
      {details.options.map((option) => (
        <div key={option.id} className="contents">
          <dt>{option.label}</dt>
          <dd className="min-w-0 wrap-break-word">{option.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ThreadModelSettings({ thread }: { readonly thread: SidebarThreadSummary }) {
  return <ModelFields details={useModelDetails(thread, true)} />;
}

export function ThreadModelBadge({
  thread,
  trackRun = false,
  children,
}: {
  readonly thread: SidebarThreadSummary;
  readonly trackRun?: boolean;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const details = useModelDetails(thread, trackRun || open);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="inline-flex min-w-0 items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        }
      >
        {children}
        <span aria-hidden className="opacity-60">
          ·
        </span>
        <span className="max-w-24 truncate opacity-80">{details.compactName}</span>
      </TooltipTrigger>
      <ThreadHoverCardPopup side="right" align="start">
        <ThreadHoverCard title="Model Settings">
          <ModelFields details={details} />
        </ThreadHoverCard>
      </ThreadHoverCardPopup>
    </Tooltip>
  );
}

export function ThreadWorkingModel({
  thread,
  working,
  trackRun,
  children,
}: {
  readonly thread: SidebarThreadSummary;
  readonly working: boolean;
  readonly trackRun: boolean;
  readonly children: ReactNode;
}) {
  return working ? (
    <ThreadModelBadge thread={thread} trackRun={trackRun}>
      {children}
    </ThreadModelBadge>
  ) : (
    children
  );
}
