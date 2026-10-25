import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { fakeTimers, render } from "../../../test/render";
import { WeeklyQuotaGauge } from "./WeeklyQuotaGauge";

function provider(usedPercent: number): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make("codex-selected"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: null,
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-10-25T12:00:30Z",
    models: [],
    slashCommands: [],
    skills: [],
    usageLimits: {
      checkedAt: "2026-10-25T12:00:30Z",
      windows: [
        {
          id: "weekly",
          kind: "weekly",
          label: "Weekly",
          usedPercent,
          resetsAt: "2026-10-28T12:00:00Z",
        },
      ],
    },
  };
}

it("updates the remaining gauge on account selection and exposes reset and snapshot details", async () => {
  using _timers = fakeTimers();
  vi.setSystemTime("2026-10-25T12:00:40Z");
  await using screen = await render(
    <WeeklyQuotaGauge provider={provider(35)} sources={[]} model="gpt-6.1-sol" />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Weekly quota 65% remaining" }))
    .toBeVisible();
  await screen.getByRole("button", { name: "Weekly quota 65% remaining" }).click();
  await expect.element(page.getByText("Resets", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Checked", { exact: true })).toBeVisible();
  await screen.rerender(
    <WeeklyQuotaGauge provider={provider(100)} sources={[]} model="gpt-6.1-sol" />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Weekly quota 0% remaining" }))
    .toBeVisible();
});

it("shows unavailable rather than a full tank when a failed probe retains old bars", async () => {
  using _timers = fakeTimers();
  vi.setSystemTime("2026-10-25T12:00:40Z");
  const selected = provider(20);
  await using screen = await render(
    <WeeklyQuotaGauge
      provider={{
        ...selected,
        usageLimits: {
          ...selected.usageLimits!,
          unavailable: { reason: "probeFailed", message: "Probe failed" },
        },
      }}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  await screen.getByRole("button", { name: "Weekly quota unavailable" }).click();
  await expect.element(page.getByText("Probe failed", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("80%", { exact: true })).not.toBeInTheDocument();
});
