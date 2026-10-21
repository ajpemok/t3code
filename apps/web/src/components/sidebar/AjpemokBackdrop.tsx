import { useId } from "react";

const CAUSTIC_LINES = Array.from({ length: 12 }, (_, index) => {
  const shift = index * 5;
  return `M-60 ${78 + shift}C42 ${-38 + shift} 128 ${132 + shift} 238 ${12 + shift}S402 ${108 + shift} 520 ${-30 + shift}`;
});

export function AjpemokBackdrop() {
  const id = useId().replaceAll(":", "");
  const metal = `${id}-metal`;
  const edge = `${id}-edge`;
  const light = `${id}-light`;
  return (
    <div
      aria-hidden="true"
      className="sidebar-stage-backdrop pointer-events-none absolute inset-x-0 top-0 z-0 h-20 overflow-hidden select-none"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 520 96"
        preserveAspectRatio="xMinYMin slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={metal} x1="18" y1="0" x2="320" y2="96" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-ajpemok-ink)" />
            <stop offset="0.42" stopColor="var(--color-ajpemok-patina)" />
            <stop offset="0.66" stopColor="var(--color-ajpemok-bronze)" />
            <stop offset="1" stopColor="var(--color-ajpemok-ink)" />
          </linearGradient>
          <linearGradient id={edge} x1="0" y1="60" x2="430" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-ajpemok-jade)" stopOpacity="0.08" />
            <stop offset="0.24" stopColor="var(--color-ajpemok-jade)" stopOpacity="0.56" />
            <stop offset="0.43" stopColor="var(--color-ajpemok-gold)" stopOpacity="0.85" />
            <stop offset="0.62" stopColor="var(--color-ajpemok-bronze)" stopOpacity="0.12" />
            <stop offset="0.8" stopColor="var(--color-ajpemok-gold)" stopOpacity="0.65" />
            <stop offset="1" stopColor="var(--color-ajpemok-jade)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={light} x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--color-ajpemok-type)" stopOpacity="0" />
            <stop offset="0.48" stopColor="var(--color-ajpemok-type)" stopOpacity="0.12" />
            <stop offset="0.5" stopColor="var(--color-ajpemok-type)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--color-ajpemok-type)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path fill={`url(#${metal})`} d="M0 0h520v96H0z" />
        <g stroke={`url(#${edge})`} strokeWidth="0.8">
          {CAUSTIC_LINES.map((line) => (
            <path key={line} d={line} />
          ))}
        </g>
        <path
          d="M-40 4C90 82 168-42 274 20S410 52 544 0"
          stroke="var(--color-ajpemok-gold)"
          strokeOpacity="0.42"
        />
        <path
          d="M-60 22C46-30 152 76 256 16S400 54 540-16"
          stroke="var(--color-ajpemok-jade)"
          strokeOpacity="0.36"
        />
        <path className="ajpemok-sheen" fill={`url(#${light})`} d="M0 0h100v96H0z" />
      </svg>
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
