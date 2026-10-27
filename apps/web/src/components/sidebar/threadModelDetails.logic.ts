import type { ModelSelection, ServerProvider } from "@t3tools/contracts";
import type { ThreadStructure } from "@t3tools/client-runtime/state/models";
import {
  createModelCapabilities,
  getProviderOptionCurrentLabel,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
  normalizeModelSlug,
} from "@t3tools/shared/model";
import type { SidebarThreadSummary } from "~/types";
import { getTriggerDisplayModelName } from "../chat/providerIconUtils";

const EMPTY_CAPABILITIES = createModelCapabilities({ optionDescriptors: [] });

export function sidebarExecutionModel(
  thread: SidebarThreadSummary,
  projection: ThreadStructure | null,
): { selection: ModelSelection; source: "reported" | "run" | "selected" } {
  const runId = thread.runtime?.activeRunId ?? thread.latestRun?.runId;
  const run = projection?.runs.find((candidate) => candidate.id === runId);
  const providerThreadId = run?.providerThreadId ?? projection?.thread.activeProviderThreadId;
  const reported = projection?.providerThreads.find(
    (candidate) => candidate.id === providerThreadId,
  )?.nativeMetadata?.modelSelection;
  const selection = run?.modelSelection ?? thread.modelSelection;
  if (reported?.instanceId === selection.instanceId && reported.model === selection.model) {
    const options = [
      ...new Map(
        [...(reported.options ?? []), ...(selection.options ?? [])].map((option) => [
          option.id,
          option,
        ]),
      ).values(),
    ];
    return {
      selection: { ...selection, ...(options.length > 0 ? { options } : {}) },
      source: run ? "run" : "reported",
    };
  }
  return { selection, source: run ? "run" : "selected" };
}

export function sidebarModelDetails(
  selection: ModelSelection,
  provider: Pick<ServerProvider, "driver" | "models" | "displayName" | "instanceId"> | undefined,
) {
  const model = provider?.models.find(
    (candidate) => candidate.slug === normalizeModelSlug(selection.model, provider.driver),
  );
  const descriptors = getProviderOptionDescriptors({
    caps: model?.capabilities ?? EMPTY_CAPABILITIES,
    selections: selection.options,
  });
  const options = descriptors.flatMap((descriptor) => {
    const stated = selection.options?.find((option) => option.id === descriptor.id)?.value;
    const value = getProviderOptionCurrentValue(descriptor, selection);
    const label =
      descriptor.type === "select" &&
      typeof stated === "string" &&
      !descriptor.options.some((option) => option.id === stated)
        ? stated
        : descriptor.id === "fastMode"
          ? typeof value === "boolean"
            ? value
              ? "Fast"
              : "Standard"
            : undefined
          : getProviderOptionCurrentLabel(descriptor, selection);
    if (label === undefined) return [];
    return [
      {
        id: descriptor.id,
        label:
          descriptor.id === "fastMode" || descriptor.id === "serviceTier"
            ? "Speed"
            : descriptor.label,
        value: descriptor.id === "serviceTier" && label === "Normal" ? "Standard" : label,
      },
    ];
  });
  for (const option of selection.options ?? []) {
    if (!descriptors.some((descriptor) => descriptor.id === option.id)) {
      options.push({ id: option.id, label: option.id, value: String(option.value) });
    }
  }
  return {
    compactName: model ? getTriggerDisplayModelName(model, provider?.driver) : selection.model,
    modelName: model?.name ?? selection.model,
    providerName: provider?.displayName ?? provider?.driver ?? selection.instanceId,
    options,
  };
}
