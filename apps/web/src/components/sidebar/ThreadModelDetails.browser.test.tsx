import { RegistryContext } from "@effect/atom-react";
import { Atom, AtomRegistry } from "effect/reactivity";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { makeThreadFixture } from "~/test-fixtures";
import { ThreadModelBadge } from "./ThreadModelDetails";

const testProvidersAtom = Atom.make([
  {
    instanceId: "codex",
    driver: "codex",
    displayName: "Codex",
    models: [
      {
        slug: "gpt-6.1-sol",
        name: "GPT-6.1-Sol",
        shortName: "Sol",
        isCustom: false,
        capabilities: {
          optionDescriptors: [
            {
              id: "reasoningEffort",
              label: "Reasoning",
              type: "select",
              currentValue: "xhigh",
              options: [{ id: "xhigh", label: "Extra High" }],
            },
            { id: "fastMode", label: "Fast Mode", type: "boolean", currentValue: false },
          ],
        },
      },
    ],
  },
]).pipe(Atom.keepAlive);

const state = vi.hoisted(() => ({ detailReads: 0 }));
vi.mock("~/state/server", () => ({
  providersIgnoringCheckedAtAtom: () => testProvidersAtom,
}));
vi.mock("~/state/threads", () => ({
  environmentThreadDetails: {
    quietThreadAtom: () => {
      state.detailReads++;
      return Atom.make(null);
    },
  },
}));

it("shows model details on hover without editing settings or leasing an idle child transcript", async () => {
  state.detailReads = 0;
  const registry = AtomRegistry.make();
  using _registry = { [Symbol.dispose]: () => registry.dispose() };
  const thread = makeThreadFixture({
    modelSelection: {
      instanceId: makeThreadFixture().modelSelection.instanceId,
      model: "gpt-6.1-sol",
      options: [{ id: "fastMode", value: true }],
    },
  });
  await using screen = await render(
    <RegistryContext.Provider value={registry}>
      <ThreadModelBadge thread={thread}>Working</ThreadModelBadge>
    </RegistryContext.Provider>,
  );
  await expect.element(screen.getByText("Sol", { exact: true })).toBeVisible();
  expect(state.detailReads).toBe(0);
  await screen.getByText("Sol", { exact: true }).hover();
  await expect.element(page.getByText("Model Settings", { exact: true })).toBeVisible();
  await expect.element(page.getByText("GPT-6.1-Sol", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Extra High", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Fast", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("combobox")).not.toBeInTheDocument();
  expect(state.detailReads).toBeGreaterThan(0);
});
