import copperSkyline from "~/assets/ajpemok/copper-skyline.webp";
import harbourLights from "~/assets/ajpemok/harbour-lights.webp";
import electricHarbour from "~/assets/ajpemok/electric-harbour.webp";
import harbourMist from "~/assets/ajpemok/harbour-mist.webp";
import violetAfterglow from "~/assets/ajpemok/violet-afterglow.webp";
import moonlitFerry from "~/assets/ajpemok/moonlit-ferry.webp";
import rainOnTheHarbour from "~/assets/ajpemok/rain-on-the-harbour.webp";
import blueHour from "~/assets/ajpemok/blue-hour.webp";
import roseDawn from "~/assets/ajpemok/rose-dawn.webp";
import midnightInk from "~/assets/ajpemok/midnight-ink.webp";
import terracottaDusk from "~/assets/ajpemok/terracotta-dusk.webp";
import emeraldHarbour from "~/assets/ajpemok/emerald-harbour.webp";

export const AJPEMOK_HEADER_SCENES = [
  { id: "copper-skyline", label: "Copper Skyline", image: copperSkyline },
  { id: "harbour-lights", label: "Harbour Lights", image: harbourLights },
  { id: "electric-harbour", label: "Electric Harbour", image: electricHarbour },
  { id: "harbour-mist", label: "Harbour Mist", image: harbourMist },
  { id: "violet-afterglow", label: "Violet Afterglow", image: violetAfterglow },
  { id: "moonlit-ferry", label: "Moonlit Ferry", image: moonlitFerry },
  { id: "rain-on-the-harbour", label: "Rain on the Harbour", image: rainOnTheHarbour },
  { id: "blue-hour", label: "Blue Hour", image: blueHour },
  { id: "rose-dawn", label: "Rose Dawn", image: roseDawn },
  { id: "midnight-ink", label: "Midnight Ink", image: midnightInk },
  { id: "terracotta-dusk", label: "Terracotta Dusk", image: terracottaDusk },
  { id: "emerald-harbour", label: "Emerald Harbour", image: emeraldHarbour },
] as const;

export function resolveAjpemokHeaderScene(id: string) {
  return AJPEMOK_HEADER_SCENES.find((scene) => scene.id === id) ?? AJPEMOK_HEADER_SCENES[0];
}
