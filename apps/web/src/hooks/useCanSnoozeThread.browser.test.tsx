import { expect, it, vi } from "vite-plus/test";
import { QUEUED_TURN_START_GRACE_MS } from "@t3tools/client-runtime/state/thread-settled";
import { act, fakeTimers, render } from "../../test/render";
import { makeThreadFixture } from "../test-fixtures";
import type { SidebarThreadSummary } from "../types";
import { useCanSnoozeThread } from "./useCanSnoozeThread";

function Availability({ thread }: { readonly thread: SidebarThreadSummary }) {
  return <span>{useCanSnoozeThread(thread) ? "Can snooze" : "Cannot snooze"}</span>;
}

it("reopens a quiet queued-turn gate and blocks pending input immediately", async () => {
  using _timers = fakeTimers();
  vi.setSystemTime("2026-10-25T12:00:00Z");
  const thread = makeThreadFixture({ latestUserMessageAt: "2026-10-25T12:00:00Z" });
  // This hook has no navigation or route state.
  await using screen = await render(<Availability thread={thread} />, { router: false });
  await expect.element(screen.getByText("Cannot snooze", { exact: true })).toBeVisible();
  await act(() => vi.advanceTimersByTimeAsync(QUEUED_TURN_START_GRACE_MS + 50));
  await expect.element(screen.getByText("Can snooze", { exact: true })).toBeVisible();
  await screen.rerender(<Availability thread={{ ...thread, hasPendingUserInput: true }} />);
  await expect.element(screen.getByText("Cannot snooze", { exact: true })).toBeVisible();
});
