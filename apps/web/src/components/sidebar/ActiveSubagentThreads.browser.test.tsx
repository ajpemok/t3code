import { RegistryContext } from "@effect/atom-react";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Atom, AtomRegistry } from "effect/reactivity";
import { useSyncExternalStore } from "react";
import { expect, it, vi } from "vite-plus/test";
import { act, render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import type { SidebarThreadSummary } from "../../types";
import { ActiveSubagentThreads, ActiveSubagentsToggle } from "./ActiveSubagentThreads";

const state = vi.hoisted(() => ({
  enabled: false,
  listeners: new Set<() => void>(),
  threads: null as unknown,
  detailReads: 0,
}));
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (
    select: (settings: { sidebarActiveSubagentsEnabled: boolean }) => unknown,
  ) => {
    const enabled = useSyncExternalStore(
      (listener) => {
        state.listeners.add(listener);
        return () => {
          state.listeners.delete(listener);
        };
      },
      () => state.enabled,
    );
    return select({ sidebarActiveSubagentsEnabled: enabled });
  },
  updateClientSettings: async (patch: { sidebarActiveSubagentsEnabled: boolean }) => {
    state.enabled = patch.sidebarActiveSubagentsEnabled;
    for (const listener of state.listeners) listener();
  },
}));
vi.mock("~/state/entities", () => ({ readThreadShell: () => null, readProject: () => null }));
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
  state.detailReads = 0;
  state.listeners.clear();
  const threads = Atom.make<readonly SidebarThreadSummary[]>([]).pipe(Atom.keepAlive);
  state.threads = threads;
  return { threads, registry: AtomRegistry.make() };
}

it("opts into active children, removes completed children and retains input requests without reading transcripts", async () => {
  const { registry, threads } = setup();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
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
  await screen.getByRole("button", { name: "Show active subagents" }).click();
  await expect
    .element(screen.getByRole("link", { name: "Open active subagent: Inspect the Diff" }))
    .toBeVisible();
  await expect.element(screen.getByText("Working", { exact: true })).toBeVisible();
  await act(() => registry.set(threads, [{ ...child, runtime: null }]));
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  await act(() => registry.set(threads, [{ ...child, runtime: null, hasPendingUserInput: true }]));
  await expect.element(screen.getByText("Awaiting Input", { exact: true })).toBeVisible();
  await screen.getByRole("button", { name: "Hide active subagents" }).click();
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
