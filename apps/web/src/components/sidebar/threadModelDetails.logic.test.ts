import {
  MessageId,
  ProviderDriverKind,
  ProviderInstanceId,
  ProviderThreadId,
  RunId,
} from "@t3tools/contracts";
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
    speed: { label: "Standard", expedited: false },
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

it.each([
  { value: "priority", catalogLabel: "Fast (2x)", label: "Priority", expedited: true },
  { value: "default", catalogLabel: "Normal routing", label: "Standard", expedited: false },
])(
  "recognises $value by its value instead of the catalogue label",
  ({ value, catalogLabel, label, expedited }) => {
    const catalog = {
      ...provider,
      models: provider.models.map((model) => ({
        ...model,
        capabilities: {
          optionDescriptors: [
            {
              id: "serviceTier",
              label: "Speed",
              type: "select" as const,
              options: [{ id: value, label: catalogLabel }],
              currentValue: value,
            },
          ],
        },
      })),
    };
    expect(
      sidebarModelDetails(
        { instanceId, model: "gpt-6.1-sol", options: [{ id: "serviceTier", value }] },
        catalog,
      ).speed,
    ).toEqual({ label, expedited });
  },
);

it("matches the composer's Standard default when the provider defaults to Fast", () => {
  const fastDefaultProvider = {
    ...provider,
    models: provider.models.map((model) => ({
      ...model,
      capabilities: {
        optionDescriptors: [
          { id: "fastMode", label: "Fast Mode", type: "boolean" as const, currentValue: true },
        ],
      },
    })),
  };
  expect(
    sidebarModelDetails({ instanceId, model: "gpt-6.1-sol" }, fastDefaultProvider).speed,
  ).toEqual({
    label: "Standard",
    expedited: false,
  });
});

it("does not invent reasoning or speed when a remote catalog is unavailable", () => {
  expect(sidebarModelDetails({ instanceId, model: "private-model" }, undefined)).toEqual({
    compactName: "private-model",
    modelName: "private-model",
    providerName: "codex",
    speed: null,
    options: [],
  });
  expect(
    sidebarModelDetails(
      { instanceId, model: "private-model", options: [{ id: "variant", value: "deep" }] },
      undefined,
    ).options,
  ).toEqual([{ id: "variant", label: "variant", value: "deep" }]);
});

it.each([
  { id: "fastMode", value: true, label: "Fast", expedited: true },
  { id: "fastMode", value: false, label: "Standard", expedited: false },
  { id: "serviceTier", value: "priority", label: "Priority", expedited: true },
  { id: "serviceTier", value: "fast", label: "Fast", expedited: true },
  { id: "serviceTier", value: "ultrafast", label: "Ultrafast", expedited: true },
  { id: "serviceTier", value: "default", label: "Standard", expedited: false },
])(
  "recognises an explicit $label speed without a remote catalogue",
  ({ id, value, label, expedited }) => {
    expect(
      sidebarModelDetails(
        { instanceId, model: "private-model", options: [{ id, value }] },
        undefined,
      ).speed,
    ).toEqual({ label, expedited });
  },
);

it("does not mistake an unknown service tier for Standard or Fast", () => {
  expect(
    sidebarModelDetails(
      { instanceId, model: "gpt-6.1-sol", options: [{ id: "serviceTier", value: "private-tier" }] },
      provider,
    ).speed,
  ).toBeNull();
});

it.each(["running", "completed", "cancelled", "failed", "interrupted", "rolled_back"] as const)(
  "uses executing settings only while the run is active (%s)",
  (status) => {
    const projection = makeThreadProjectionFixture();
    const runId = RunId.make("running");
    const executing = {
      instanceId,
      model: "gpt-6.1-sol",
      options: [{ id: "serviceTier", value: "default" }],
    };
    const thread = makeThreadFixture({
      modelSelection: {
        instanceId,
        model: "next-turn-model",
        options: [{ id: "serviceTier", value: "priority" }],
      },
      latestRun: {
        runId,
        status,
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
            status,
            requestedAt: projection.updatedAt,
            startedAt: null,
            completedAt: null,
            checkpointId: null,
            contextHandoffId: null,
          },
        ],
      }),
    ).toEqual(
      status === "running"
        ? { selection: executing, source: "run" }
        : { selection: thread.modelSelection, source: "selected" },
    );
    expect(sidebarExecutionModel(thread, null)).toEqual({
      selection: thread.modelSelection,
      source: "selected",
    });
  },
);

it("fills missing options from a matching provider report without losing explicit settings", () => {
  const projection = makeThreadProjectionFixture();
  const providerThreadId = ProviderThreadId.make("provider-thread");
  const selection = {
    instanceId,
    model: "gpt-6.1-sol",
    options: [{ id: "reasoningEffort", value: "xhigh" }],
  };
  const thread = makeThreadFixture({ modelSelection: selection });
  const reported = { ...selection, options: [{ id: "fastMode", value: true }] };
  const providerThread = {
    id: providerThreadId,
    driver: provider.driver,
    providerInstanceId: instanceId,
    providerSessionId: null,
    appThreadId: thread.id,
    ownerNodeId: null,
    nativeThreadRef: null,
    nativeConversationHeadRef: null,
    status: "active" as const,
    firstRunOrdinal: null,
    lastRunOrdinal: null,
    handoffIds: [],
    forkedFrom: null,
    pendingBackgroundTasks: [],
    contextUsage: null,
    nativeMetadata: { modelSelection: reported },
    goal: null,
    createdAt: projection.updatedAt,
    updatedAt: projection.updatedAt,
  };
  const snapshot = {
    ...projection,
    thread: { ...projection.thread, activeProviderThreadId: providerThreadId },
    providerThreads: [providerThread],
  };
  expect(sidebarExecutionModel(thread, snapshot).selection.options).toEqual([
    { id: "fastMode", value: true },
    { id: "reasoningEffort", value: "xhigh" },
  ]);
  const standard = sidebarExecutionModel(
    {
      ...thread,
      modelSelection: { ...selection, options: [{ id: "fastMode", value: false }] },
    },
    {
      ...snapshot,
      providerThreads: [
        {
          ...providerThread,
          nativeMetadata: {
            modelSelection: { ...reported, options: [{ id: "serviceTier", value: "fast" }] },
          },
        },
      ],
    },
  );
  expect(sidebarModelDetails(standard.selection, provider).speed).toEqual({
    label: "Standard",
    expedited: false,
  });
  expect(
    sidebarExecutionModel(thread, {
      ...snapshot,
      providerThreads: [
        {
          ...providerThread,
          nativeMetadata: { modelSelection: { ...reported, model: "previous-model" } },
        },
      ],
    }),
  ).toEqual({ selection, source: "selected" });
});
