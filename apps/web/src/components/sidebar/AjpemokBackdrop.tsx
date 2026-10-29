import { useEffect, useRef } from "react";
import { useClientSettings } from "~/hooks/useSettings";
import { resolveAjpemokHeaderScene } from "./ajpemokHeaderScenes";

export function AjpemokBackdrop() {
  const sceneId = useClientSettings((settings) => settings.ajpemokHeaderScene);
  const motion = useClientSettings((settings) => settings.ajpemokHeaderMotion);
  const scene = resolveAjpemokHeaderScene(sceneId);
  const backdropRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Coordinate the optional header animation with focus, visibility and reduced motion.
  useEffect(() => {
    const header = backdropRef.current?.parentElement;
    const sweep = sweepRef.current;
    if (!motion || !header || !sweep) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animation | undefined;
    const visible = () =>
      !document.hidden && document.hasFocus() && header.getClientRects().length > 0;
    const play = () => {
      if (!visible() || reducedMotion.matches || animation?.playState === "running") return;
      animation = sweep.animate(
        [
          { transform: "translateX(-150%) skewX(-20deg)", opacity: 0 },
          { opacity: 0.22, offset: 0.45 },
          { transform: "translateX(450%) skewX(-20deg)", opacity: 0 },
        ],
        { duration: 1100, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    };
    const schedule = () => {
      clearTimeout(timer);
      if (!visible() || reducedMotion.matches) {
        animation?.cancel();
        return;
      }
      timer = setTimeout(() => {
        play();
        schedule();
      }, 120_000);
    };
    header.addEventListener("pointerenter", play);
    header.addEventListener("focusin", play);
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("focus", schedule);
    window.addEventListener("blur", schedule);
    reducedMotion.addEventListener("change", schedule);
    schedule();
    return () => {
      clearTimeout(timer);
      animation?.cancel();
      header.removeEventListener("pointerenter", play);
      header.removeEventListener("focusin", play);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("blur", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, [motion]);

  return (
    <div
      ref={backdropRef}
      aria-hidden="true"
      className="sidebar-stage-backdrop pointer-events-none absolute inset-x-0 top-0 z-0 h-20 overflow-hidden bg-ajpemok-ink select-none"
    >
      <img src={scene.image} alt="" decoding="async" className="h-full w-full object-cover" />
      <div
        ref={sweepRef}
        className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white to-transparent opacity-0"
      />
    </div>
  );
}

export function AjpemokWordmark() {
  return (
    <span
      aria-label="AJP3 Fork"
      className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs tracking-widest"
    >
      <span className="font-bold">AJP3</span>
      <span className="font-medium opacity-65">Fork</span>
    </span>
  );
}
