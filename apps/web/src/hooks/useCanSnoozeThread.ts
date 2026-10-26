import {
  canSnooze,
  hasQueuedTurnStart,
  QUEUED_TURN_START_GRACE_MS,
} from "@t3tools/client-runtime/state/thread-settled";
import { useState } from "react";
import type { SidebarThreadSummary } from "~/types";
import { useDeadlinePassed } from "./useDeadline";

export function useCanSnoozeThread(thread: SidebarThreadSummary) {
  // The compiler needs a stateful clock to reopen a quiet queued-turn gate.
  const [clock, setClock] = useState(() => ({ thread, now: new Date().toISOString() }));
  if (clock.thread !== thread) {
    // oxlint-disable-next-line react/purity -- Reseed the gate clock only when the thread changes, matching the upstream row clock.
    setClock({ thread, now: new Date().toISOString() });
  }
  const expiry = hasQueuedTurnStart(thread, { now: clock.now })
    ? Date.parse(thread.latestUserMessageAt ?? "") + QUEUED_TURN_START_GRACE_MS
    : Number.NaN;
  const opensAt = Number.isFinite(expiry) && expiry > Date.parse(clock.now) ? expiry + 50 : null;
  const opened = useDeadlinePassed(opensAt);
  if (opened && opensAt !== null) setClock({ thread, now: new Date(opensAt).toISOString() });
  return canSnooze(thread, { now: clock.now });
}
