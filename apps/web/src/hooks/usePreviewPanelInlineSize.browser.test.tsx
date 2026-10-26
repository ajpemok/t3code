import { useRef } from "react";
import { expect, it, vi } from "vite-plus/test";
import { act, render, stubGlobal } from "../../test/render";
import { usePreviewPanelInlineSize } from "./usePreviewPanelInlineSize";

function Layout({ width, enabled = true }: { width: number; enabled?: boolean }) {
  const panel = useRef<HTMLElement>(null);
  const size = usePreviewPanelInlineSize(panel, {
    enabled,
    widthStorageKey: "test:window-edge-panel",
  });
  return (
    <div style={{ display: "flex", width, height: 300 }}>
      <main data-testid="conversation" style={{ flex: 1 }} />
      <aside ref={panel} data-testid="panel" style={{ width: size.width, flexShrink: 0 }} />
    </div>
  );
}

it("gives window width changes to the open side panel while keeping the conversation steady", async () => {
  using _viewport = stubGlobal("innerWidth", 1600);
  // This fixture measures layout without navigation.
  await using screen = await render(<Layout width={1400} />, { router: false });
  const conversation = screen.getByTestId("conversation").element();
  const panel = screen.getByTestId("panel").element();
  await vi.waitFor(() => expect(conversation.getBoundingClientRect().width).toBe(860));
  await screen.rerender(<Layout width={1640} />);
  await act(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1840 });
    window.dispatchEvent(new Event("resize"));
  });
  await vi.waitFor(() => {
    expect(panel.getBoundingClientRect().width).toBe(780);
    expect(conversation.getBoundingClientRect().width).toBe(860);
  });
  await screen.rerender(<Layout width={1640} enabled={false} />);
  await screen.rerender(<Layout width={1840} enabled={false} />);
  await act(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 2040 });
    window.dispatchEvent(new Event("resize"));
  });
  await vi.waitFor(() => expect(panel.getBoundingClientRect().width).toBe(780));
  await screen.rerender(<Layout width={1840} />);
  await vi.waitFor(() => expect(panel.getBoundingClientRect().width).toBe(780));
});
