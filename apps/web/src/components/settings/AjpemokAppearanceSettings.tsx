import { AJPEMOK_HEADER_SCENES, resolveAjpemokHeaderScene } from "../sidebar/ajpemokHeaderScenes";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { searchableSetting } from "./settingsSearch";
import { resolveSidebarSubagentVisibility } from "@t3tools/contracts";

export function AjpemokAppearanceSettings() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const selectedScene = resolveAjpemokHeaderScene(settings.ajpemokHeaderScene);
  return (
    <SettingsSection id="ajpemok-sidebar" title="Sidebar">
      <SettingsRow
        {...searchableSetting("legacy-sidebar")}
        description="Show collapsible project sections with activity summaries. Turn off to use the flat task list."
        control={
          <Switch
            aria-label="Project Sections"
            checked={settings.legacySidebarEnabled}
            onCheckedChange={(checked) =>
              updateSettings({ legacySidebarEnabled: Boolean(checked) })
            }
          />
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-active-subagents")}
        description="Choose which subagents appear beneath their parent thread."
        control={
          <Select
            value={resolveSidebarSubagentVisibility(settings)}
            onValueChange={(value) => {
              if (value === "show" || value === "hide") {
                updateSettings({
                  sidebarSubagentVisibility: value,
                  sidebarActiveSubagentsEnabled: value !== "hide",
                });
              }
            }}
          >
            <SelectTrigger aria-label="Subagents">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="hide">Hide</SelectItem>
            </SelectPopup>
          </Select>
        }
      />
      <SettingsRow
        {...searchableSetting("ajpemok-header-scene")}
        description="Choose a Sydney scene for the sidebar header."
        control={
          <Select
            value={selectedScene.id}
            onValueChange={(id) => {
              if (typeof id === "string" && AJPEMOK_HEADER_SCENES.some((scene) => scene.id === id))
                updateSettings({ ajpemokHeaderScene: id });
            }}
          >
            <SelectTrigger size="sm" aria-label="Header Scene">
              <SelectValue>{selectedScene.label}</SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {AJPEMOK_HEADER_SCENES.map((scene) => (
                <SelectItem key={scene.id} value={scene.id}>
                  <span className="flex items-center gap-3">
                    <img
                      src={scene.image}
                      alt=""
                      loading="lazy"
                      className="h-6 w-16 rounded-sm object-cover"
                    />
                    <span>{scene.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        }
      />
      <SettingsRow
        {...searchableSetting("ajpemok-header-motion")}
        description="Brief light sweeps on hover and every two minutes while the window is focused. Respects reduced motion."
        control={
          <Switch
            aria-label="Header Effects"
            checked={settings.ajpemokHeaderMotion}
            onCheckedChange={(checked) => updateSettings({ ajpemokHeaderMotion: Boolean(checked) })}
          />
        }
      />
    </SettingsSection>
  );
}
