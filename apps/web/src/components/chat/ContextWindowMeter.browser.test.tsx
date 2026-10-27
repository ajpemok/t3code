import { expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { deriveLatestContextWindowSnapshot } from "~/lib/contextWindow";
import { ContextWindowMeter } from "./ContextWindowMeter";

function usage() {
  const snapshot = deriveLatestContextWindowSnapshot([], {
    usedTokens: 4_000,
    maxTokens: 10_000,
    inputTokens: 3_000,
    cachedInputTokens: 2_000,
    outputTokens: 1_000,
    reasoningOutputTokens: 300,
    updatedAt: "2026-10-25T01:00:00Z",
  });
  if (!snapshot) throw new Error("Missing fixture usage");
  return snapshot;
}

it("distinguishes current context from reported processed tokens and shows the breakdown", async () => {
  await using screen = await render(
    <ContextWindowMeter usage={{ ...usage(), totalProcessedTokens: 20_000 }} />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Context window 40% used" }))
    .toHaveTextContent("40%· 20k tokens");
  await screen.getByRole("button", { name: "Context window 40% used" }).click();
  await expect.element(page.getByText("4k/10k", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Total processed", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Input tokens", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Cached input tokens", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Output tokens", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Reasoning tokens", { exact: true })).toBeVisible();
});

it("does not invent a processed total or unsupported token breakdown", async () => {
  const snapshot = usage();
  await using screen = await render(
    <ContextWindowMeter
      usage={{
        ...snapshot,
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        reasoningOutputTokens: null,
        totalProcessedTokens: null,
      }}
    />,
  );
  await expect
    .element(screen.getByRole("button", { name: "Context window 40% used" }))
    .toHaveTextContent("40%· 4k tokens");
  await screen.getByRole("button", { name: "Context window 40% used" }).click();
  await expect.element(page.getByText("Total processed", { exact: true })).not.toBeInTheDocument();
  await expect.element(page.getByText("Input tokens", { exact: true })).not.toBeInTheDocument();
});

it("keeps compaction availability in the button without explanatory paragraphs", async () => {
  await using screen = await render(
    <ContextWindowMeter
      usage={{ ...usage(), compactsAutomatically: true }}
      modelDisplayName="Example Model"
      onCompact={() => {}}
      compactDisabled
      compactDisabledReason="Wait for the current turn to finish"
    />,
  );
  await screen.getByRole("button", { name: "Context window 40% used" }).click();
  await expect.element(page.getByRole("button", { name: "Compact Unavailable" })).toBeDisabled();
  await expect
    .element(page.getByText("Context for Example Model", { exact: false }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByText("Wait for the current turn to finish", { exact: true }))
    .not.toBeInTheDocument();
});
