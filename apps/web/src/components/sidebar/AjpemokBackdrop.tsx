import skyline from "~/assets/ajpemok/sydney-copper-skyline.png";

export function AjpemokBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="sidebar-stage-backdrop pointer-events-none absolute inset-x-0 top-0 z-0 h-20 overflow-hidden bg-ajpemok-ink select-none"
    >
      <img src={skyline} alt="" decoding="async" className="h-full w-full object-cover" />
    </div>
  );
}

export function AjpemokWordmark() {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap text-xs font-semibold tracking-widest">
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none">
        <path
          d="m3 16 7-12 7 12M6 12h8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M8 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      AJPEMOK
    </span>
  );
}
