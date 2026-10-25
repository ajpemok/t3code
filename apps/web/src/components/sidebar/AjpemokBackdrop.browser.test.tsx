import { expect, it, vi } from "vite-plus/test";
import { act, fakeTimers, render } from "../../../test/render";
import { AjpemokBackdrop } from "./AjpemokBackdrop";

const state = vi.hoisted(() => ({
  ajpemokHeaderScene: "copper-skyline",
  ajpemokHeaderMotion: true,
}));
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (select: (settings: typeof state) => unknown) => select(state),
}));

function setup() {
  state.ajpemokHeaderScene = "copper-skyline";
  state.ajpemokHeaderMotion = true;
}

it("plays on hover and repeats only after the idle interval", async () => {
  setup();
  using _focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  using _hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const animation = new Animation();
  using animate = vi.spyOn(Element.prototype, "animate").mockReturnValue(animation);
  using _timers = fakeTimers();
  // This backdrop has no navigation or route state.
  await using screen = await render(
    <div>
      <AjpemokBackdrop />
    </div>,
    { router: false },
  );
  expect(animate).not.toHaveBeenCalled();
  screen.container.firstElementChild!.dispatchEvent(new PointerEvent("pointerenter"));
  expect(animate).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(119_999));
  expect(animate).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(animate).toHaveBeenCalledTimes(2);
});

it("cancels idle effects when hidden and restarts one timer when visible", async () => {
  setup();
  using _focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  using hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const animation = new Animation();
  using cancel = vi.spyOn(animation, "cancel");
  using animate = vi.spyOn(Element.prototype, "animate").mockReturnValue(animation);
  using _timers = fakeTimers();
  // This backdrop has no navigation or route state.
  await using screen = await render(
    <div>
      <AjpemokBackdrop />
    </div>,
    { router: false },
  );
  screen.container.firstElementChild!.dispatchEvent(new PointerEvent("pointerenter"));
  hidden.mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));
  await act(() => vi.advanceTimersByTimeAsync(240_000));
  expect(animate).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalled();
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  await act(() => vi.advanceTimersByTimeAsync(120_000));
  expect(animate).toHaveBeenCalledTimes(2);
  await screen.unmount();
  await act(() => vi.advanceTimersByTimeAsync(240_000));
  expect(animate).toHaveBeenCalledTimes(2);
});

it("keeps the header still when effects are disabled", async () => {
  setup();
  state.ajpemokHeaderMotion = false;
  using _focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  using animate = vi.spyOn(Element.prototype, "animate");
  using _timers = fakeTimers();
  // This backdrop has no navigation or route state.
  await using screen = await render(
    <div>
      <AjpemokBackdrop />
    </div>,
    { router: false },
  );
  screen.container.firstElementChild!.dispatchEvent(new PointerEvent("pointerenter"));
  await act(() => vi.advanceTimersByTimeAsync(240_000));
  expect(animate).not.toHaveBeenCalled();
});

it("respects reduced motion for hover and idle effects", async () => {
  setup();
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  using _matches = vi.spyOn(media, "matches", "get").mockReturnValue(true);
  using _media = vi.spyOn(window, "matchMedia").mockReturnValue(media);
  using _focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  using animate = vi.spyOn(Element.prototype, "animate");
  using _timers = fakeTimers();
  // This backdrop has no navigation or route state.
  await using screen = await render(
    <div>
      <AjpemokBackdrop />
    </div>,
    { router: false },
  );
  screen.container.firstElementChild!.dispatchEvent(new PointerEvent("pointerenter"));
  await act(() => vi.advanceTimersByTimeAsync(240_000));
  expect(animate).not.toHaveBeenCalled();
});
