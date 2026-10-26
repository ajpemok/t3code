import {
  EnvironmentId,
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { AsyncResult } from "effect/reactivity";
import { page } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { WeeklyQuotaGauge } from "./WeeklyQuotaGauge";
import "~/index.css";

const state = vi.hoisted(() => ({ canManage: true, consume: vi.fn() }));
vi.mock(import("~/state/session"), async (original) => ({
  ...(await original()),
  readEnvironmentScope: () => state.canManage,
  useEnvironmentScope: () => state.canManage,
}));
vi.mock("~/state/use-atom-command", () => ({
  useAtomCommand: () => state.consume,
}));
const environmentId = EnvironmentId.make("quota-environment");
function setup() {
  state.canManage = true;
  state.consume.mockReset();
  state.consume.mockResolvedValue(AsyncResult.success({ outcome: "reset" }));
}

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

it("updates the remaining gauge on account selection and shows the shared usage details", async () => {
  setup();
  using _now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T12:00:40Z"));
  await using screen = await render(
    <WeeklyQuotaGauge
      environmentId={environmentId}
      provider={provider(35)}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Weekly quota 65% remaining" }))
    .toBeVisible();
  await screen.getByRole("button", { name: "Weekly quota 65% remaining" }).click();
  await expect.element(page.getByText("Resets", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Signed in", { exact: true })).toBeVisible();
  await screen.rerender(
    <WeeklyQuotaGauge
      environmentId={environmentId}
      provider={provider(100)}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Weekly quota 0% remaining" }))
    .toBeVisible();
});

it("shows unavailable rather than a full tank when a failed probe retains old bars", async () => {
  setup();
  using _now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T12:00:40Z"));
  const selected = provider(20);
  await using screen = await render(
    <WeeklyQuotaGauge
      environmentId={environmentId}
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

it("shows banked credits and requires the native confirmation before spending one", async () => {
  setup();
  using _now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T12:00:40Z"));
  const base = provider(49);
  const selected = {
    ...base,
    usageLimits: {
      ...base.usageLimits!,
      resetCredits: { availableCount: 2, nextExpiresAt: "2026-10-26T06:00:00Z" },
    },
  };
  await using screen = await render(
    <WeeklyQuotaGauge
      environmentId={environmentId}
      provider={selected}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  const trigger = screen.getByRole("button", {
    name: /Weekly quota 51% remaining, 2 reset credits banked, important/,
  });
  await trigger.click();
  await expect.element(page.getByText(/2 banked/)).toBeVisible();
  await page.getByRole("button", { name: "Use reset", exact: true }).click();
  await expect.element(page.getByRole("alertdialog")).toBeVisible();
  expect(state.consume).not.toHaveBeenCalled();
  await page.getByRole("button", { name: "Use credit", exact: true }).click();
  expect(state.consume).toHaveBeenCalledWith({
    environmentId,
    input: { instanceId: selected.instanceId },
  });
  await expect
    .element(screen.getByRole("status"))
    .toHaveTextContent("Reset applied. Your windows have cleared.");
});

it("dismisses an open credit confirmation when the selected account changes", async () => {
  setup();
  using _now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T12:00:40Z"));
  const base = provider(49);
  const selected = {
    ...base,
    auth: { status: "authenticated" as const, email: "first@example.test" },
    usageLimits: {
      ...base.usageLimits!,
      resetCredits: { availableCount: 2, nextExpiresAt: "2026-10-27T00:00:00Z" },
    },
  };
  await using screen = await render(
    <WeeklyQuotaGauge
      environmentId={environmentId}
      provider={selected}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  await screen.getByRole("button", { name: /Weekly quota 51% remaining/ }).click();
  await page.getByRole("button", { name: "Use reset", exact: true }).click();
  await expect.element(page.getByRole("alertdialog")).toBeVisible();
  await screen.rerender(
    <WeeklyQuotaGauge
      environmentId={environmentId}
      provider={{
        ...provider(40),
        auth: { status: "authenticated", email: "second@example.test" },
      }}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
  expect(state.consume).not.toHaveBeenCalled();
  await expect
    .element(screen.getByRole("button", { name: "Weekly quota 60% remaining", exact: true }))
    .toBeVisible();
});

it("keeps banked credits visible without allowing a read-only connection to redeem them", async () => {
  setup();
  state.canManage = false;
  using _now = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-25T12:00:40Z"));
  const base = provider(49);
  const selected = {
    ...base,
    usageLimits: {
      ...base.usageLimits!,
      resetCredits: { availableCount: 2, nextExpiresAt: "2026-10-27T00:00:00Z" },
    },
  };
  await using screen = await render(
    <WeeklyQuotaGauge
      environmentId={environmentId}
      provider={selected}
      sources={[]}
      model="gpt-6.1-sol"
    />,
  );
  await screen.getByRole("button", { name: /Weekly quota 51% remaining/ }).click();
  await expect.element(page.getByText(/2 banked/)).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Use reset", exact: true })).toBeDisabled();
  expect(state.consume).not.toHaveBeenCalled();
});
