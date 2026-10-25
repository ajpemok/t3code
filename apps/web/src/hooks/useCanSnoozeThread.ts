import {
  canSnooze,
  hasQueuedTurnStart,
  QUEUED_TURN_START_GRACE_MS,
} from "@t3tools/client-runtime/state/thread-settled";
import { useEffect, useState } from "react";
import type { SidebarThreadSummary } from "~/types";

export function useCanSnoozeThread(thread: SidebarThreadSummary) {
  // The compiler needs a stateful clock to reopen a quiet queued-turn gate.
  const [clock, setClock] = useState(() => ({ thread, now: new Date().toISOString() }));
  if (clock.thread !== thread) setClock({ thread, now: new Date().toISOString() });
  const expiry = hasQueuedTurnStart(thread, { now: clock.now })
    ? Date.parse(thread.latestUserMessageAt ?? "") + QUEUED_TURN_START_GRACE_MS
    : Number.NaN;
  useEffect(() => {
    if (!Number.isFinite(expiry) || expiry <= Date.parse(clock.now)) return;
    const timer = window.setTimeout(
      () => setClock({ thread, now: new Date().toISOString() }),
      Math.min(Math.max(0, expiry - Date.now()) + 50, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [expiry, clock.now, thread]);
  return canSnooze(thread, { now: clock.now });
}
