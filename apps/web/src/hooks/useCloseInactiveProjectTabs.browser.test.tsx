import { expect, it, vi } from "vite-plus/test";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { ProjectId, ThreadId } from "@t3tools/contracts";
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
}: {
  readonly threads: readonly SidebarThreadSummary[];
  readonly selectedThreadKey: string | null;
}) {
  const { closeInactiveTabs } = useCloseInactiveProjectTabs({ threads, selectedThreadKey });
  return <button onClick={() => void closeInactiveTabs()}>Close inactive views</button>;
}

it("closes only the selected project's idle views through the hook and panel store", async () => {
  const target = makeThreadFixture();
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
