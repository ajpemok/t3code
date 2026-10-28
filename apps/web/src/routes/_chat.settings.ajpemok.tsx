import { createFileRoute } from "@tanstack/react-router";
import { AjpemokSettingsPanel } from "../components/settings/AjpemokSettingsPanel";

export const Route = createFileRoute("/_chat/settings/ajpemok")({
  component: AjpemokSettingsPanel,
});
