import { MessageId, ProviderDriverKind, ProviderInstanceId, RunId } from "@t3tools/contracts";
import type { ServerProvider } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { makeThreadFixture, makeThreadProjectionFixture } from "~/test-fixtures";
import { sidebarExecutionModel, sidebarModelDetails } from "./threadModelDetails.logic";

const instanceId = ProviderInstanceId.make("codex");
const provider = {
  instanceId,
  driver: ProviderDriverKind.make("codex"),
  displayName: "Codex Work",
  models: [
    {
      slug: "gpt-6.1-sol",
      name: "GPT-6.1-Sol",
      shortName: "Sol",
      isCustom: false,
      capabilities: {
        optionDescriptors: [
          {
            id: "reasoningEffort",
            label: "Reasoning",
            type: "select",
            currentValue: "xhigh",
            options: [{ id: "xhigh", label: "Extra High" }],
          },
          {
            id: "serviceTier",
            label: "Service Tier",
            type: "select",
            currentValue: "default",
            options: [
              { id: "default", label: "Normal" },
              { id: "fast", label: "Fast" },
            ],
          },
        ],
      },
    },
  ],
} satisfies Pick<ServerProvider, "instanceId" | "driver" | "displayName" | "models">;

it("uses catalog model names, reasoning and Standard/Fast labels", () => {
  const selection = { instanceId, model: "gpt-6.1-sol" };
  expect(sidebarModelDetails(selection, provider)).toMatchObject({
    compactName: "Sol",
    modelName: "GPT-6.1-Sol",
    providerName: "Codex Work",
    options: [
      { id: "reasoningEffort", value: "Extra High" },
      { id: "serviceTier", label: "Speed", value: "Standard" },
    ],
  });
  expect(
    sidebarModelDetails({ ...selection, options: [{ id: "serviceTier", value: "fast" }] }, provider)
      .options,
  ).toContainEqual({ id: "serviceTier", label: "Speed", value: "Fast" });
});

it("preserves a provider choice absent from the cached catalog", () => {
  expect(
    sidebarModelDetails(
      { instanceId, model: "gpt-6.1-sol", options: [{ id: "reasoningEffort", value: "ultra" }] },
      provider,
    ).options,
  ).toContainEqual({ id: "reasoningEffort", label: "Reasoning", value: "ultra" });
});

it("does not invent reasoning or speed when a remote catalog is unavailable", () => {
  expect(sidebarModelDetails({ instanceId, model: "private-model" }, undefined)).toEqual({
    compactName: "private-model",
    modelName: "private-model",
    providerName: "codex",
    options: [],
  });
  expect(
    sidebarModelDetails(
      { instanceId, model: "private-model", options: [{ id: "variant", value: "deep" }] },
      undefined,
    ).options,
  ).toEqual([{ id: "variant", label: "variant", value: "deep" }]);
});

it("keeps the executing run's model when next-turn settings change", () => {
  const projection = makeThreadProjectionFixture();
  const runId = RunId.make("running");
  const executing = { instanceId, model: "gpt-6.1-sol" };
  const thread = makeThreadFixture({
    modelSelection: { instanceId, model: "next-turn-model" },
    latestRun: {
      runId,
      status: "running",
      requestedAt: null,
      startedAt: null,
      completedAt: null,
      assistantMessageId: null,
    },
  });
  expect(
    sidebarExecutionModel(thread, {
      ...projection,
      runs: [
        {
          id: runId,
          threadId: thread.id,
          ordinal: 1,
          providerInstanceId: instanceId,
          modelSelection: executing,
          providerThreadId: null,
          userMessageId: MessageId.make("message"),
          rootNodeId: null,
          activeAttemptId: null,
          status: "running",
          requestedAt: projection.updatedAt,
          startedAt: null,
          completedAt: null,
          checkpointId: null,
          contextHandoffId: null,
        },
      ],
    }),
  ).toEqual({ selection: executing, source: "run" });
  expect(sidebarExecutionModel(thread, null)).toEqual({
    selection: thread.modelSelection,
    source: "selected",
  });
});
