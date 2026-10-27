import { RegistryContext } from "@effect/atom-react";
import { EnvironmentId, ProviderInstanceId, RunId, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Atom, AtomRegistry } from "effect/reactivity";
import { useSyncExternalStore } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { act, fakeTimers, render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import type { SidebarThreadSummary } from "../../types";
import { ActiveSubagentThreads, ActiveSubagentsToggle } from "./ActiveSubagentThreads";

const testProvidersAtom = Atom.make([]).pipe(Atom.keepAlive);

const state = vi.hoisted(() => ({
  enabled: false,
  mode: undefined as "show" | "active" | "hide" | undefined,
  previewCount: 3,
  hideInactive: false,
  keepRecent: false,
  revision: 0,
  listeners: new Set<() => void>(),
  threads: null as unknown,
  detailReads: 0,
}));
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (
    select: (settings: {
      sidebarActiveSubagentsEnabled: boolean;
      sidebarSubagentVisibility?: "show" | "active" | "hide" | undefined;
      sidebarSubagentPreviewCount: number;
      sidebarHideInactiveEnabled: boolean;
      sidebarRecentSectionEnabled: boolean;
      sidebarKeepRecentThreadsVisible: boolean;
      sidebarRecentIncludeSubagents: boolean;
    }) => unknown,
  ) => {
    useSyncExternalStore(
      (listener) => {
        state.listeners.add(listener);
        return () => {
          state.listeners.delete(listener);
        };
      },
      () => state.revision,
    );
    return select({
      sidebarActiveSubagentsEnabled: state.enabled,
      sidebarSubagentVisibility: state.mode,
      sidebarSubagentPreviewCount: state.previewCount,
      sidebarHideInactiveEnabled: state.hideInactive,
      sidebarRecentSectionEnabled: false,
      sidebarKeepRecentThreadsVisible: state.keepRecent,
      sidebarRecentIncludeSubagents: true,
    });
  },
  updateClientSettings: async (patch: {
    sidebarActiveSubagentsEnabled?: boolean;
    sidebarSubagentVisibility?: "show" | "active" | "hide";
    sidebarSubagentPreviewCount?: number;
  }) => {
    if (patch.sidebarActiveSubagentsEnabled !== undefined)
      state.enabled = patch.sidebarActiveSubagentsEnabled;
    if (patch.sidebarSubagentVisibility !== undefined) state.mode = patch.sidebarSubagentVisibility;
    if (patch.sidebarSubagentPreviewCount !== undefined)
      state.previewCount = patch.sidebarSubagentPreviewCount;
    state.revision++;
    for (const listener of state.listeners) listener();
  },
}));
vi.mock("~/state/server", () => ({
  providersIgnoringCheckedAtAtom: () => testProvidersAtom,
}));
vi.mock("~/state/entities", () => ({ readThreadShell: () => null, readProject: () => null }));
vi.mock("~/hooks/useCloseInactiveProjectTabs", () => ({
  useCloseInactiveProjectTabs: () => ({ showTaskContextMenu: async () => {} }),
}));
vi.mock("~/state/threads", () => ({
  environmentThreadShells: {
    get quietThreadShellsAtom() {
      return state.threads;
    },
  },
  environmentThreadDetails: {
    quietVisibleTurnItemsAtom: () => {
      state.detailReads++;
      throw new Error("Subagent rows must not subscribe to transcripts");
    },
  },
}));

function setup() {
  state.enabled = false;
  state.mode = undefined;
  state.previewCount = 3;
  state.hideInactive = false;
  state.keepRecent = false;
  state.revision = 0;
  state.detailReads = 0;
  state.listeners.clear();
  const threads = Atom.make<readonly SidebarThreadSummary[]>([]).pipe(Atom.keepAlive);
  state.threads = threads;
  return { threads, registry: AtomRegistry.make() };
}

it("opts into active children, removes completed children and retains input requests without reading transcripts", async () => {
  const { registry, threads } = setup();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  state.hideInactive = true;
  const parentId = ThreadId.make("parent");
  const child = makeThreadFixture({
    id: ThreadId.make("child"),
    title: "Inspect the Diff",
    lineage: { rootThreadId: parentId, parentThreadId: parentId, relationshipToParent: "subagent" },
    runtime: {
      status: "running",
      providerInstanceId: ProviderInstanceId.make("codex"),
      providerName: "Codex",
      activeRunId: null,
      lastError: null,
      updatedAt: "2026-10-25T12:00:00Z",
    },
  });
  registry.set(threads, [child]);
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <ActiveSubagentsToggle />
      <ActiveSubagentThreads threadRef={scopeThreadRef(child.environmentId, parentId)} enabled />
    </RegistryContext.Provider>,
  );
  await expect
    .element(screen.getByRole("link", { name: "Open active subagent: Inspect the Diff" }))
    .not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Subagents: Hide" }).click();
  await page.getByRole("menuitemradio", { name: "Show", exact: true }).click();
  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("link", { name: "Open active subagent: Inspect the Diff" }))
    .toBeVisible();
  await expect.element(screen.getByText("Working", { exact: true })).toBeVisible();
  await act(() => registry.set(threads, [{ ...child, runtime: null }]));
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  await act(() => registry.set(threads, [{ ...child, runtime: null, hasPendingUserInput: true }]));
  await expect.element(screen.getByText("Awaiting Input", { exact: true })).toBeVisible();
  await screen.getByRole("button", { name: "Subagents: Show" }).click();
  await expect.element(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Hide", exact: true }).click();
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  expect(state.detailReads).toBe(0);
});

it("does not cross environments or lease children while a parent is offscreen", async () => {
  const { registry, threads } = setup();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  state.enabled = true;
  const parentId = ThreadId.make("parent");
  const child = makeThreadFixture({
    title: "Other Environment",
    hasPendingUserInput: true,
    lineage: { rootThreadId: parentId, parentThreadId: parentId, relationshipToParent: "subagent" },
  });
  registry.set(threads, [child]);
  const ref = scopeThreadRef(EnvironmentId.make("other-environment"), parentId);
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <ActiveSubagentThreads threadRef={ref} enabled />
    </RegistryContext.Provider>,
  );
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  await screen.rerender(
    <RegistryContext.Provider value={registry}>
      <ActiveSubagentThreads
        threadRef={scopeThreadRef(child.environmentId, parentId)}
        enabled={false}
      />
    </RegistryContext.Provider>,
  );
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  expect(state.detailReads).toBe(0);
});

it("limits shown children, expands them and respects Hide Inactive without reading transcripts", async () => {
  const { registry, threads } = setup();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  state.mode = "show";
  state.previewCount = 2;
  const parentId = ThreadId.make("parent");
  const children = ["First", "Second", "Third"].map((title, index) =>
    makeThreadFixture({
      id: ThreadId.make(`child-${index}`),
      title,
      hasPendingUserInput: index === 2,
      lineage: {
        rootThreadId: parentId,
        parentThreadId: parentId,
        relationshipToParent: "subagent",
      },
    }),
  );
  registry.set(threads, children);
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <ActiveSubagentThreads
        threadRef={scopeThreadRef(children[0]!.environmentId, parentId)}
        enabled
      />
    </RegistryContext.Provider>,
  );
  await expect.element(screen.getByRole("link", { name: "Open subagent: First" })).toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: "Open subagent: Third" }))
    .not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Show 1 more subagent" }).click();
  await expect.element(screen.getByRole("link", { name: "Open subagent: Third" })).toBeVisible();
  await screen.getByRole("button", { name: "Show fewer subagents" }).click();
  await expect
    .element(screen.getByRole("link", { name: "Open subagent: Third" }))
    .not.toBeInTheDocument();
  await act(() => {
    state.hideInactive = true;
    state.revision++;
    for (const listener of state.listeners) listener();
  });
  await expect
    .element(screen.getByRole("link", { name: "Open active subagent: Third" }))
    .toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: "Open active subagent: First" }))
    .not.toBeInTheDocument();
  expect(state.detailReads).toBe(0);
});

it("keeps a recently finished subagent under Hide Inactive when retention is enabled", async () => {
  using _timers = fakeTimers({ now: Date.parse("2026-10-28T12:00:00Z") });
  const { registry, threads } = setup();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  state.mode = "show";
  state.hideInactive = true;
  state.keepRecent = true;
  const parentId = ThreadId.make("parent");
  const child = makeThreadFixture({
    id: ThreadId.make("recent-child"),
    title: "Finished Child",
    lineage: { rootThreadId: parentId, parentThreadId: parentId, relationshipToParent: "subagent" },
    latestRun: {
      runId: RunId.make("child-run"),
      status: "completed",
      requestedAt: null,
      startedAt: "2026-10-28T11:50:00Z",
      completedAt: "2026-10-28T11:59:00Z",
      assistantMessageId: null,
    },
  });
  registry.set(threads, [child]);
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <ActiveSubagentThreads threadRef={scopeThreadRef(child.environmentId, parentId)} enabled />
    </RegistryContext.Provider>,
  );
  await expect
    .element(screen.getByRole("link", { name: "Open recent subagent: Finished Child" }))
    .toBeVisible();
  await act(() => {
    state.keepRecent = false;
    state.revision++;
    for (const listener of state.listeners) listener();
  });
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  expect(state.detailReads).toBe(0);
});
