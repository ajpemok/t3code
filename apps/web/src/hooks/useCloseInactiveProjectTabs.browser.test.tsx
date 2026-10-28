import { expect, it, vi } from "vite-plus/test";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { EnvironmentId, ProjectId, ThreadId, type ScopedThreadRef } from "@t3tools/contracts";
import type { SidebarThreadSummary } from "~/types";
import { makeThreadFixture } from "~/test-fixtures";
import { selectThreadRightPanelState, useRightPanelStore } from "~/rightPanelStore";
import { render } from "../../test/render";
import { useCloseInactiveProjectTabs } from "./useCloseInactiveProjectTabs";

const state = vi.hoisted(() => ({ threads: [] as SidebarThreadSummary[] }));
vi.mock("~/state/entities", () => ({
  readThreadShell: (ref: { environmentId: string; threadId: string }) =>
    state.threads.find(
      (thread) => thread.environmentId === ref.environmentId && thread.id === ref.threadId,
    ) ?? null,
  readProject: () => null,
}));

function Harness({
  threads,
  selectedThreadKey,
  target,
}: {
  readonly threads: readonly SidebarThreadSummary[];
  readonly selectedThreadKey: string | null;
  readonly target?: ScopedThreadRef;
}) {
  const { closeInactiveTabs } = useCloseInactiveProjectTabs({ threads, selectedThreadKey });
  return <button onClick={() => void closeInactiveTabs(target)}>Close inactive views</button>;
}

it("closes only the selected project's idle views through the hook and panel store", async () => {
  const idle = makeThreadFixture();
  const target = makeThreadFixture({
    runtime: {
      status: "idle",
      activeRunId: null,
      providerInstanceId: idle.providerInstanceId,
      providerName: "codex",
      lastError: null,
      updatedAt: idle.updatedAt,
    },
  });
  const other = makeThreadFixture({
    id: ThreadId.make("other-project-thread"),
    projectId: ProjectId.make("other-project"),
  });
  state.threads = [target, other];
  const targetRef = scopeThreadRef(target.environmentId, target.id);
  const otherRef = scopeThreadRef(other.environmentId, other.id);
  useRightPanelStore.setState({ byThreadKey: {} });
  useRightPanelStore.getState().openFile(targetRef, "one.txt");
  useRightPanelStore.getState().openFile(targetRef, "two.txt");
  useRightPanelStore.getState().openFile(otherRef, "retain.txt");
  await using screen = await render(<Harness threads={[target]} selectedThreadKey={null} />);
  await screen.getByRole("button", { name: "Close inactive views" }).click();
  expect(
    selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, targetRef).surfaces,
  ).toEqual([]);
  expect(
    selectThreadRightPanelState(useRightPanelStore.getState().byThreadKey, otherRef).surfaces,
  ).toHaveLength(1);
  useRightPanelStore.setState({ byThreadKey: {} });
});

it("limits task cleanup to its environment and leaves its parent, sibling and another environment untouched", async () => {
  const parent = makeThreadFixture({ id: ThreadId.make("parent") });
  const child = makeThreadFixture({
    id: ThreadId.make("child"),
    lineage: {
      rootThreadId: parent.id,
      parentThreadId: parent.id,
      relationshipToParent: "subagent",
    },
  });
  const sibling = { ...child, id: ThreadId.make("sibling") };
  const remote = { ...child, environmentId: EnvironmentId.make("remote") };
  state.threads = [parent, child, sibling, remote];
  useRightPanelStore.setState({ byThreadKey: {} });
  for (const thread of state.threads)
    useRightPanelStore
      .getState()
      .openFile(scopeThreadRef(thread.environmentId, thread.id), "keep-or-close.txt");
  await using screen = await render(
    <Harness
      threads={state.threads}
      selectedThreadKey={null}
      target={scopeThreadRef(child.environmentId, child.id)}
    />,
  );
  await screen.getByRole("button", { name: "Close inactive views" }).click();
  expect(
    selectThreadRightPanelState(
      useRightPanelStore.getState().byThreadKey,
      scopeThreadRef(child.environmentId, child.id),
    ).surfaces,
  ).toHaveLength(0);
  for (const thread of [parent, sibling, remote])
    expect(
      selectThreadRightPanelState(
        useRightPanelStore.getState().byThreadKey,
        scopeThreadRef(thread.environmentId, thread.id),
      ).surfaces,
    ).toHaveLength(1);
  useRightPanelStore.setState({ byThreadKey: {} });
});
