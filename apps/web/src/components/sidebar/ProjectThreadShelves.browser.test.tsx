import { AsyncResult } from "effect/reactivity";
import * as Cause from "effect/Cause";
import { ThreadId } from "@t3tools/contracts";
import { type ComponentProps, useSyncExternalStore } from "react";
import { expect, it, vi } from "vite-plus/test";
import { act, fakeTimers, render } from "../../../test/render";
import { makeThreadFixture } from "../../test-fixtures";
import type { SidebarThreadSummary } from "../../types";
import { ProjectThreadShelves } from "./ProjectThreadShelves";

const state = vi.hoisted(() => ({
  threads: [] as SidebarThreadSummary[],
  listeners: new Set<() => void>(),
  canOperate: true,
}));
vi.mock("~/hooks/useRecentThreads", () => ({
  useRecentThreads: () => ({ entries: [], retainedKeys: new Set<string>(), showSection: false }),
}));
vi.mock("~/state/entities", () => ({
  useProject: () => null,
  readThreadShell: () => null,
  readProject: () => null,
  useQuietThreadShells: () =>
    useSyncExternalStore(
      (listener) => {
        state.listeners.add(listener);
        return () => {
          state.listeners.delete(listener);
        };
      },
      () => state.threads,
    ),
  useServerConfigs: () =>
    new Map([
      [
        "environment-test",
        { environment: { capabilities: { threadSettlement: true, threadSnooze: true } } },
      ],
    ]),
}));
vi.mock("~/hooks/useCloseInactiveProjectTabs", () => ({
  useCloseInactiveProjectTabs: () => ({ showTaskContextMenu: async () => {} }),
}));
vi.mock("~/state/session", () => ({
  readEnvironmentScope: () => state.canOperate,
  useEnvironmentScope: () => state.canOperate,
}));
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (select: (settings: { sidebarHideInactiveEnabled: boolean }) => unknown) =>
    select({ sidebarHideInactiveEnabled: false }),
}));

function setup() {
  localStorage.removeItem("t3code:sidebar:snoozed-expanded");
  localStorage.removeItem("t3code:sidebar:settled-expanded");
  state.listeners.clear();
  state.canOperate = true;
  state.threads = [
    makeThreadFixture({
      id: ThreadId.make("settled"),
      title: "Finished Task",
      settledOverride: "settled",
      settledAt: "2026-10-25T11:00:00Z",
    }),
    makeThreadFixture({
      id: ThreadId.make("snoozed"),
      title: "Later Task",
      snoozedAt: "2026-10-25T11:00:00Z",
      snoozedUntil: "2026-10-25T13:00:00Z",
    }),
  ];
  const restore = async (id: string) => {
    state.threads = state.threads.map((thread) =>
      thread.id === id
        ? { ...thread, settledOverride: null, snoozedAt: null, snoozedUntil: null }
        : thread,
    );
    for (const listener of state.listeners) listener();
    return AsyncResult.success({ sequence: 1 });
  };
  return {
    unsettleThread: vi.fn<ComponentProps<typeof ProjectThreadShelves>["actions"]["unsettleThread"]>(
      async (ref) => restore(ref.threadId),
    ),
    unsnoozeThread: vi.fn<ComponentProps<typeof ProjectThreadShelves>["actions"]["unsnoozeThread"]>(
      async (ref) => restore(ref.threadId),
    ),
  };
}

it("shows both collapsed shelves and restores parked threads through their native actions", async () => {
  const actions = setup();
  using _timers = fakeTimers();
  vi.setSystemTime("2026-10-25T12:00:00Z");
  await using screen = await render(<ProjectThreadShelves actions={actions} />);
  await expect.element(screen.getByRole("button", { name: "Snoozed (1)" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Settled (1)" })).toBeVisible();
  await screen.getByRole("button", { name: "Settled (1)" }).click();
  await screen.getByRole("button", { name: "Unsettle Finished Task" }).click();
  await expect.element(screen.getByRole("button", { name: "Settled (0)" })).toBeVisible();
  await expect.element(screen.getByRole("link", { name: "Finished Task" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Snoozed (1)" }).click();
  await screen.getByRole("button", { name: "Unsnooze Later Task" }).click();
  await expect.element(screen.getByRole("button", { name: "Snoozed (0)" })).toBeVisible();
  expect(actions.unsettleThread).toHaveBeenCalledWith({
    environmentId: "environment-test",
    threadId: "settled",
  });
  expect(actions.unsnoozeThread).toHaveBeenCalledWith({
    environmentId: "environment-test",
    threadId: "snoozed",
  });
});

it("retains a row after an interrupted restore and hides mutations without permission", async () => {
  const actions = setup();
  actions.unsettleThread.mockResolvedValue(AsyncResult.failure(Cause.interrupt()));
  using _timers = fakeTimers();
  vi.setSystemTime("2026-10-25T12:00:00Z");
  await using screen = await render(<ProjectThreadShelves actions={actions} />);
  await screen.getByRole("button", { name: "Settled (1)" }).click();
  await screen.getByRole("button", { name: "Unsettle Finished Task" }).click();
  await expect.element(screen.getByRole("link", { name: "Finished Task" })).toBeVisible();
  state.canOperate = false;
  await screen.rerender(<ProjectThreadShelves actions={{ ...actions }} />);
  await expect
    .element(screen.getByRole("button", { name: "Unsettle Finished Task" }))
    .not.toBeInTheDocument();
});

it("wakes at a second-precise snooze boundary without waiting for the minute tick", async () => {
  const actions = setup();
  state.threads = [{ ...state.threads[1]!, snoozedUntil: "2026-10-25T12:00:03Z" }];
  using _timers = fakeTimers();
  vi.setSystemTime("2026-10-25T12:00:00Z");
  await using screen = await render(<ProjectThreadShelves actions={actions} />);
  await expect.element(screen.getByRole("button", { name: "Snoozed (1)" })).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(3_050));
  await expect.element(screen.getByRole("button", { name: "Snoozed (0)" })).toBeVisible();
});
