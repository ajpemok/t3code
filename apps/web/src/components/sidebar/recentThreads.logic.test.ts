import { EnvironmentId, RunId, ThreadId } from "@t3tools/contracts";
import { expect, it } from "vite-plus/test";
import { makeThreadFixture, type ThreadFixtureOverrides } from "~/test-fixtures";
import { filterProjectSectionThreads, subagentsByParent } from "../Sidebar.logic";
import { recentThreads, recentThreadVisibilityKeys, todayThreads } from "./recentThreads.logic";

const now = "2026-10-28T12:00:00.000Z";
const options = { now, count: 5, maxAgeMinutes: 60, includeSubagents: true };
function finished(id: string, at: string, overrides: ThreadFixtureOverrides = {}) {
  return makeThreadFixture({
    id: ThreadId.make(id),
    latestRun: {
      runId: RunId.make(id),
      status: "completed",
      requestedAt: at,
      startedAt: at,
      completedAt: at,
      assistantMessageId: null,
    },
    ...overrides,
  });
}

it("limits finished threads by count and age, with zero age allowing older results", () => {
  const threads = Array.from({ length: 8 }, (_, i) =>
    finished(`thread-${i}`, `2026-10-28T11:${String(59 - i).padStart(2, "0")}:00.000Z`),
  );
  const old = finished("old", "2026-10-27T12:00:00.000Z");
  expect(
    recentThreads([old, ...threads.toReversed()], options).map((entry) => entry.thread.id),
  ).toEqual(threads.slice(0, 5).map((thread) => thread.id));
  expect(recentThreads([old], options)).toEqual([]);
  expect(recentThreads([old], { ...options, maxAgeMinutes: 0 })).toMatchObject([{ thread: old }]);
  const children = threads.slice(0, 3).map((thread) => ({
    ...thread,
    id: ThreadId.make(`child-${thread.id}`),
    lineage: {
      rootThreadId: old.id,
      parentThreadId: old.id,
      relationshipToParent: "subagent" as const,
    },
  }));
  expect(
    recentThreads([...threads, ...children], {
      ...options,
      count: 1,
      subagentCount: 2,
      subagentMaxAgeMinutes: 60,
    }),
  ).toHaveLength(3);
  expect(
    recentThreads([...threads, ...children], {
      ...options,
      count: 1,
      subagentCount: 2,
      subagentMaxAgeMinutes: 1,
    }),
  ).toHaveLength(1);
});

it("dismisses only the selected completion and shows a later completion again", () => {
  const first = finished("thread", "2026-10-28T11:50:00.000Z");
  const other = { ...first, environmentId: EnvironmentId.make("other") };
  const dismissed = { "environment-test:thread": first.latestRun!.completedAt! };
  expect(recentThreads([first, other], { ...options, dismissed })).toMatchObject([
    { thread: other },
  ]);
  expect(
    recentThreadVisibilityKeys(recentThreads([first], { ...options, dismissed }), [first]).size,
  ).toBe(0);
  const next = finished("thread", "2026-10-28T11:59:00.000Z");
  expect(recentThreads([next], { ...options, dismissed })).toMatchObject([{ thread: next }]);
  expect(recentThreads([first], { ...options, dismissed: {} })).toMatchObject([{ thread: first }]);
});

it("lists other completions from the past 24 hours in Today without parked threads", () => {
  const recent = finished("recent", "2026-10-28T11:59:00.000Z");
  const earlier = finished("earlier", "2026-10-28T02:00:00.000Z");
  const settled = finished("settled", "2026-10-28T11:58:00.000Z", {
    settledOverride: "settled",
  });
  const settledChild = finished("settled-child", "2026-10-28T11:57:00.000Z", {
    lineage: {
      rootThreadId: settled.id,
      parentThreadId: settled.id,
      relationshipToParent: "subagent",
    },
  });
  const sameIdElsewhere = { ...recent, environmentId: EnvironmentId.make("other") };
  const atCutoff = finished("cutoff", "2026-10-27T12:00:00.000Z");
  const future = finished("future", "2026-10-29T00:00:00.000Z");
  const snoozed = finished("snoozed", now, {
    snoozedAt: now,
    snoozedUntil: "2026-10-29T00:00:00Z",
  });
  const threads = [
    earlier,
    recent,
    sameIdElsewhere,
    settled,
    settledChild,
    atCutoff,
    future,
    snoozed,
  ];
  expect(
    todayThreads(
      threads,
      [{ thread: recent, finishedAt: recent.latestRun!.completedAt!, parentTitle: null }],
      options,
    ).map(({ thread }) => thread.id),
  ).toEqual([sameIdElsewhere.id, earlier.id]);
  expect(
    todayThreads([recent], [], {
      ...options,
      dismissed: { "environment-test:recent": recent.latestRun!.completedAt! },
    }),
  ).toEqual([]);
  expect(
    todayThreads([{ ...settled, settledOverride: "active" }, settledChild], [], options).map(
      ({ thread }) => thread.id,
    ),
  ).toEqual([settled.id, settledChild.id]);
});

it("does not bring parked, archived, empty or newly active threads into Recent", () => {
  const done = finished("done", now);
  const running = {
    ...done,
    latestRun: { ...done.latestRun!, status: "running" as const, completedAt: null },
  };
  expect(
    recentThreads(
      [
        running,
        makeThreadFixture(),
        finished("settled", now, { settledOverride: "settled" }),
        finished("snoozed", now, { snoozedAt: now, snoozedUntil: "2026-10-29T00:00:00Z" }),
        finished("archived", now, { archivedAt: now }),
        finished("question", now, { hasPendingUserInput: true }),
      ],
      options,
    ),
  ).toEqual([]);
});

it("keeps recently finished native children and their parent in the same environment", () => {
  const parent = makeThreadFixture({ id: ThreadId.make("parent"), title: "Parent" });
  const base = makeThreadFixture({
    id: ThreadId.make("child"),
    lineage: {
      rootThreadId: parent.id,
      parentThreadId: parent.id,
      relationshipToParent: "subagent",
    },
    updatedAt: now,
  });
  const child = { ...base, source: { ...base.source, status: "completed" as const } };
  const otherParent = { ...parent, environmentId: EnvironmentId.make("other") };
  const all = [parent, otherParent, child];
  const recent = recentThreads(all, options);
  expect(recent).toMatchObject([{ thread: child, parentTitle: "Parent" }]);
  expect([...recentThreadVisibilityKeys(recent, all)]).toEqual([
    "environment-test:child",
    "environment-test:parent",
  ]);
  const recentKeys = recentThreadVisibilityKeys(recent, all);
  expect(
    filterProjectSectionThreads(all, {
      now,
      capabilities: new Map(),
      hideInactive: true,
      recentKeys,
    }),
  ).toEqual([parent]);
  expect(
    subagentsByParent(all, "active", { now, recentKeys }).get("environment-test:parent"),
  ).toEqual([child]);
  expect(recentThreads(all, { ...options, includeSubagents: false })).toEqual([]);
  expect(recentThreads([{ ...parent, settledOverride: "settled" }, child], options)).toEqual([]);
});

it("respects pinned parents for subagents and accepts interrupted/failed runs", () => {
  const parent = makeThreadFixture({ id: ThreadId.make("parent"), pinnedAt: now });
  const child = finished("child", now, {
    lineage: {
      rootThreadId: parent.id,
      parentThreadId: parent.id,
      relationshipToParent: "subagent",
    },
  });
  expect(recentThreads([parent, child], { ...options, pinnedOnly: true })).toMatchObject([
    { thread: child },
  ]);
  expect(
    recentThreads([{ ...parent, pinnedAt: null }, child], { ...options, pinnedOnly: true }),
  ).toEqual([]);
  for (const status of ["failed", "interrupted"] as const) {
    const done = finished(status, now);
    expect(
      recentThreads([{ ...done, latestRun: { ...done.latestRun!, status } }], options),
    ).toHaveLength(1);
  }
});
