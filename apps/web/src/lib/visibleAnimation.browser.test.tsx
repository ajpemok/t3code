import { expect, it, vi } from "vite-plus/test";
import { render, stubGlobal } from "../../test/render";
import { observeVisibleAnimation } from "./visibleAnimation";

it("pauses visible effects offscreen, in hidden documents and with reduced motion, then releases observers", async () => {
  let notify: (entries: IntersectionObserverEntry[]) => void = () => {};
  const unobserve = vi.fn();
  const disconnect = vi.fn();
  class Observer implements IntersectionObserver {
    root = null;
    rootMargin = "0px";
    scrollMargin = "0px";
    thresholds = [0];
    takeRecords() {
      return [];
    }
    constructor(callback: IntersectionObserverCallback) {
      notify = (entries) => callback(entries, this);
    }
    observe() {}
    unobserve = unobserve;
    disconnect = disconnect;
  }
  using _observer = stubGlobal("IntersectionObserver", Observer);
  const media = new EventTarget();
  let reduced = false;
  const query = Object.defineProperty(media, "matches", { get: () => reduced });
  using _media = vi.spyOn(window, "matchMedia").mockReturnValue(query as MediaQueryList);
  using visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  // The observer has no navigation or route state.
  await using screen = await render(<span ref={observeVisibleAnimation} />, { router: false });
  const element = screen.container.firstElementChild as HTMLElement;
  const intersect = (isIntersecting: boolean) =>
    notify([
      {
        target: element,
        isIntersecting,
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRect: element.getBoundingClientRect(),
        intersectionRatio: isIntersecting ? 1 : 0,
        rootBounds: null,
        time: 0,
      },
    ]);
  const state = () => element.style.getPropertyValue("--visible-animation-state");
  expect(state()).toBe("paused");
  intersect(true);
  expect(state()).toBe("running");
  intersect(false);
  expect(state()).toBe("paused");
  intersect(true);
  visibility.mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(state()).toBe("paused");
  visibility.mockReturnValue("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  expect(state()).toBe("running");
  reduced = true;
  media.dispatchEvent(new Event("change"));
  expect(state()).toBe("paused");
  await screen.unmount();
  expect(unobserve).toHaveBeenCalledWith(element);
  expect(disconnect).toHaveBeenCalledOnce();
});
