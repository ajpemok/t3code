import { Profiler } from "react";
import { RegistryContext } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { RunId, ThreadId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { act, fakeTimers, render } from "../../../test/render";
import { makeThreadFixture } from "~/test-fixtures";
import type { SidebarThreadSummary } from "~/types";
import { RecentThreadsShelf } from "./RecentThreadsShelf";

const state = vi.hoisted(() => ({ threads: null as unknown }));
const testProvidersAtom = Atom.make([]);
vi.mock("~/state/server", () => ({
  providersIgnoringCheckedAtAtom: () => testProvidersAtom,
}));
vi.mock("~/state/threads", () => ({
  environmentThreadDetails: { quietThreadAtom: () => Atom.make(null) },
  environmentThreadShells: {
    get quietThreadShellsAtom() {
      return state.threads;
    },
  },
}));
vi.mock("~/state/entities", () => ({ useProject: () => null }));
vi.mock("~/hooks/useThreadRouteTarget", () => ({ useThreadRouteRef: () => null }));
vi.mock("~/hooks/useCloseInactiveProjectTabs", () => ({
  useCloseInactiveProjectTabs: () => ({ showTaskContextMenu: async () => {} }),
}));
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (select: (settings: object) => unknown) =>
    select({
      sidebarRecentSectionEnabled: true,
      sidebarKeepRecentThreadsVisible: true,
      sidebarSubagentVisibility: "show",
      sidebarRecentThreadCount: 5,
      sidebarRecentThreadMaxAgeMinutes: 60,
    }),
}));

it("shows finished threads, supports collapse and removes a thread from Recent when it resumes", async () => {
  using _timers = fakeTimers({ now: Date.parse("2026-10-28T12:00:00Z") });
  localStorage.removeItem("t3code:sidebar:recent-expanded");
  localStorage.removeItem("t3code:sidebar:recent-dismissed");
  const registry = AtomRegistry.make();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  const threads = Atom.make<readonly SidebarThreadSummary[]>([]).pipe(Atom.keepAlive);
  state.threads = threads;
  const thread = makeThreadFixture({
    id: ThreadId.make("recent"),
    title: "Finished Thread",
    latestRun: {
      runId: RunId.make("run"),
      status: "completed",
      requestedAt: null,
      startedAt: "2026-10-28T11:50:00Z",
      completedAt: "2026-10-28T11:59:00Z",
      assistantMessageId: null,
    },
  });
  registry.set(threads, [thread]);
  const commits = vi.fn();
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <Profiler id="recent" onRender={commits}>
        <RecentThreadsShelf />
      </Profiler>
    </RegistryContext.Provider>,
  );
  await expect.element(screen.getByRole("button", { name: "Recent (1)" })).toBeVisible();
  await expect.element(screen.getByRole("link", { name: "Finished Thread" })).toBeVisible();
  commits.mockClear();
  await act(() =>
    registry.set(threads, [
      thread,
      makeThreadFixture({ id: ThreadId.make("unrelated"), hasPendingUserInput: true }),
    ]),
  );
  expect(commits).not.toHaveBeenCalled();
  await screen.getByRole("link", { name: "Finished Thread" }).hover();
  await screen.getByRole("button", { name: "Dismiss Finished Thread from Recent" }).click();
  await expect.element(screen.getByRole("button", { name: "Recent (0)" })).toBeVisible();
  await screen.getByRole("button", { name: "Restore dismissed recent threads" }).click();
  await expect.element(screen.getByRole("link", { name: "Finished Thread" })).toBeVisible();
  await screen.getByRole("button", { name: "Recent (1)" }).click();
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Recent (1)" }).click();
  await expect.element(screen.getByRole("link", { name: "Finished Thread" })).toBeVisible();
  await act(() =>
    registry.set(threads, [
      { ...thread, latestRun: { ...thread.latestRun!, status: "running", completedAt: null } },
    ]),
  );
  await expect.element(screen.getByRole("button", { name: "Recent (0)" })).toBeVisible();
  await expect.element(screen.getByRole("link")).not.toBeInTheDocument();
});
