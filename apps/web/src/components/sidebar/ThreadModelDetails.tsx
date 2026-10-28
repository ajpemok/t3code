import { useAtomValue } from "@effect/atom-react";
import {
  parseScopedThreadKey,
  scopeThreadRef,
  scopedThreadKey,
} from "@t3tools/client-runtime/environment";
import { Atom } from "effect/reactivity";
import { useState, type ReactNode } from "react";
import { CpuIcon, ZapIcon } from "lucide-react";
import { providersIgnoringCheckedAtAtom } from "~/state/server";
import { environmentThreadDetails } from "~/state/threads";
import type { SidebarThreadSummary } from "~/types";
import { ThreadHoverCard, ThreadHoverCardPopup } from "../ThreadHoverCard";
import { Tooltip, TooltipTrigger } from "../ui/tooltip";
import { sidebarExecutionModel, sidebarModelDetails } from "./threadModelDetails.logic";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { modelSelectionsEqual } from "@t3tools/shared/model";

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
  const provider = providers.find((candidate) => candidate.instanceId === selection.instanceId);
  return {
    ...sidebarModelDetails(selection, provider),
    provider,
    source,
    nextTurn:
      source === "run" && !modelSelectionsEqual(selection, thread.modelSelection)
        ? sidebarModelDetails(
            thread.modelSelection,
            providers.find(
              (candidate) => candidate.instanceId === thread.modelSelection.instanceId,
            ),
          )
        : null,
  };
}

function ModelFields({
  details,
  modelLabel = "Thread Model",
}: {
  readonly details: ReturnType<typeof sidebarModelDetails>;
  readonly modelLabel?: string;
}) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1.5">
      <dt>{modelLabel}</dt>
      <dd className="min-w-0 wrap-break-word text-foreground">{details.modelName}</dd>
      <dt>Provider</dt>
      <dd className="min-w-0 wrap-break-word">{details.providerName}</dd>
      {details.options.map((option) => (
        <div key={option.id} className="contents">
          <dt>{option.label}</dt>
          <dd className="min-w-0 wrap-break-word">{option.value}</dd>
        </div>
      ))}
      {!details.options.some((option) => option.label === "Speed") ? (
        <>
          <dt>Speed</dt>
          <dd>{details.speed?.label ?? "Not reported"}</dd>
        </>
      ) : null}
    </dl>
  );
}

function ModelSettings({ details }: { readonly details: ReturnType<typeof useModelDetails> }) {
  return (
    <>
      <ModelFields
        details={details}
        modelLabel={details.source === "run" ? "Run Model" : "Thread Model"}
      />
      {details.nextTurn ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-foreground">Next Turn</p>
          <ModelFields details={details.nextTurn} modelLabel="Selected Model" />
        </div>
      ) : null}
    </>
  );
}

export function ThreadModelIdentity({
  thread,
  trackRun = false,
  children,
  leading,
  showName = false,
  statusLabel,
}: {
  readonly thread: SidebarThreadSummary;
  readonly trackRun?: boolean;
  readonly children?: ReactNode;
  readonly leading?: ReactNode;
  readonly showName?: boolean;
  readonly statusLabel?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const details = useModelDetails(
    thread,
    (trackRun && thread.runtime?.activeRunId != null) || open,
  );
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={[
              statusLabel,
              details.modelName,
              details.speed ? `${details.speed.label} mode` : "Speed not reported",
            ]
              .filter(Boolean)
              .join(" · ")}
            className="inline-flex min-w-0 shrink-0 items-center gap-1 rounded-sm text-sidebar-foreground leading-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        }
      >
        {leading}
        {children ??
          (details.provider ? (
            <span className="inline-flex size-3.5 shrink-0 items-center justify-center">
              <ProviderInstanceIcon
                driverKind={details.provider.driver}
                displayName={details.providerName}
                size="compact"
              />
            </span>
          ) : (
            <CpuIcon aria-hidden className="size-3.5" />
          ))}
        {details.speed?.expedited ? (
          <span
            role="img"
            aria-label={`${details.speed.label} mode`}
            className="inline-flex size-3.5 shrink-0 items-center justify-center"
          >
            <ZapIcon aria-hidden className="size-3.5 fill-current" />
          </span>
        ) : null}
        {showName ? (
          <span className="max-w-24 truncate text-3xs text-secondary-label">
            {details.compactName}
          </span>
        ) : null}
      </TooltipTrigger>
      <ThreadHoverCardPopup side="right" align="start">
        <ThreadHoverCard title="Model Settings">
          {statusLabel ? <p className="mb-2 text-foreground">{statusLabel}</p> : null}
          <ModelSettings details={details} />
        </ThreadHoverCard>
      </ThreadHoverCardPopup>
    </Tooltip>
  );
}

export function ThreadModelSettings({ thread }: { readonly thread: SidebarThreadSummary }) {
  return <ModelSettings details={useModelDetails(thread, true)} />;
}

export function ThreadModelBadge({
  thread,
  trackRun = false,
  children,
  statusLabel,
}: {
  readonly thread: SidebarThreadSummary;
  readonly trackRun?: boolean;
  readonly children: ReactNode;
  readonly statusLabel?: string | undefined;
}) {
  return (
    <ThreadModelIdentity
      thread={thread}
      trackRun={trackRun}
      showName
      leading={children}
      statusLabel={statusLabel}
    />
  );
}
