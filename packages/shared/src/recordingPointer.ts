import type { BrowserRecordingPointer } from "@t3tools/contracts";

export const RECORDING_POINTER_PRESETS = [
  {
    id: "classic",
    label: "Classic Arrow",
    imageAspectRatio: 2 / 3,
    hotspotX: 0.06,
    hotspotY: 0.04,
  },
  { id: "slim", label: "Slim Arrow", imageAspectRatio: 3 / 4, hotspotX: 0.125, hotspotY: 0.0625 },
  { id: "rounded", label: "Rounded Arrow", imageAspectRatio: 5 / 7, hotspotX: 0.1, hotspotY: 0.07 },
  { id: "precision", label: "Precision Ring", imageAspectRatio: 1, hotspotX: 0.5, hotspotY: 0.5 },
  { id: "delta", label: "Delta", imageAspectRatio: 1, hotspotX: 0.08, hotspotY: 0.08 },
  { id: "kite", label: "Kite", imageAspectRatio: 1, hotspotX: 0.08, hotspotY: 0.08 },
  { id: "chevron", label: "Chevron", imageAspectRatio: 1, hotspotX: 0.08, hotspotY: 0.08 },
] as const;

const POINTER_SHAPES = {
  classic: ["0 0 16 24", '<path d="M1 1v18l4-4 4 8 3-1.5-4-8H15Z"/>'],
  slim: ["0 0 24 32", '<path d="M3 2 21 21 13 20 16.5 29 13 30.5 9.5 21.5 4 27Z"/>'],
  rounded: [
    "0 0 20 28",
    '<path d="M2 2v20q0 1.5 1.2.3L7 18l4 8q.5 1 1.5.5l2-1q1-.5.5-1.5l-4-8h6q1.5 0 .4-1Z"/>',
  ],
  precision: [
    "0 0 24 24",
    '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.2" stroke="none"/>',
  ],
  delta: ["0 0 25 25", '<path d="M2 2 23 13 13 15 9 23Z"/>'],
  kite: [
    "0 0 25 25",
    '<path d="M2 2 23 11 15 15 11 23Z"/><path d="M2 2 15 15" fill="none" opacity=".35"/>',
  ],
  chevron: ["0 0 25 25", '<path d="M2 2 23 13 14 14 13 23Z"/>'],
} as const;

export function recordingPointerImage(pointer: BrowserRecordingPointer): string {
  if (pointer.imageDataUrl) return pointer.imageDataUrl;
  const [viewBox, shape] = POINTER_SHAPES[pointer.shape];
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="${pointer.fill}" stroke="${pointer.outline}" stroke-width="1.25" stroke-linejoin="round">${shape}</svg>`)}`;
}
