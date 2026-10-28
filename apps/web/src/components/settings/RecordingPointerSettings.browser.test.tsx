import { DEFAULT_BROWSER_RECORDING_POINTER } from "@t3tools/contracts";
import { useState } from "react";
import { expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "../../../test/render";
import { RecordingPointerEditor } from "./RecordingPointerSettings";
import "~/index.css";

function Editor() {
  const [pointer, setPointer] = useState(DEFAULT_BROWSER_RECORDING_POINTER);
  const [halo, setHalo] = useState(true);
  return (
    <RecordingPointerEditor
      value={pointer}
      onChange={setPointer}
      showHalo={halo}
      onHaloChange={setHalo}
    />
  );
}

it("imports a custom image, edits its hotspot and restores the default pointer", async () => {
  await using screen = await render(<Editor />);
  const image = new File(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="48"><path fill="#ff00ff" d="M0 0v48l12-12 12 12 8-8-12-12 12-8z"/></svg>',
    ],
    "pointer.svg",
    { type: "image/svg+xml" },
  );
  await userEvent.upload(screen.getByLabelText("Pointer image"), image);
  await expect.element(screen.getByLabelText("Pointer Preset")).toHaveTextContent("Custom Image");
  await screen.getByRole("textbox", { name: "Hotspot X (%)", exact: true }).click();
  await userEvent.keyboard("{Control>}a{/Control}{Backspace}50{Tab}");
  await expect.element(screen.getByLabelText("Hotspot X (%)")).toHaveValue("50");
  await screen.getByRole("button", { name: "Reset Pointer" }).click();
  await expect.element(screen.getByLabelText("Pointer Preset")).toHaveTextContent("Classic Arrow");
  await expect.element(screen.getByLabelText("Hotspot X (%)")).toHaveValue("6");
  await screen.getByLabelText("Pointer Preset").click();
  await page.getByRole("option", { name: "Precision Ring" }).click();
  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByLabelText("Hotspot X (%)")).toHaveValue("50");
  await expect.element(screen.getByLabelText("Hotspot Y (%)")).toHaveValue("50");
  await screen.getByRole("switch", { name: "Show Pointer" }).click();
  await expect.element(screen.getByRole("switch", { name: "Show Pointer" })).not.toBeChecked();
});
