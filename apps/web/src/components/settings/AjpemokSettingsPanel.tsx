import { RecentThreadsSettings } from "./RecentThreadsSettings";
import { AJPEMOK_HEADER_SCENES, resolveAjpemokHeaderScene } from "../sidebar/ajpemokHeaderScenes";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";
import {
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
  SettingsUnavailableGroup,
} from "./settingsLayout";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { searchableSetting } from "./settingsSearch";
import {
  MAX_SIDEBAR_THREAD_PREVIEW_COUNT,
  MIN_SIDEBAR_THREAD_PREVIEW_COUNT,
  resolveSidebarSubagentVisibility,
} from "@t3tools/contracts";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldDecrement,
  NumberFieldIncrement,
} from "../ui/number-field";
import { isElectron } from "~/env";
import { RecordingPointerSettings } from "./RecordingPointerSettings";

export function AjpemokSettingsPanel() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const selectedScene = resolveAjpemokHeaderScene(settings.ajpemokHeaderScene);
  return (
    <SettingsPageContainer>
      <SettingsSection id="ajpemok-sidebar" title="Sidebar">
        <SettingsRow
          {...searchableSetting("legacy-sidebar")}
          description="Show collapsible project sections with activity summaries. Turn off to use the flat thread list."
          control={
            <Switch
              aria-label="Project Sections"
              checked={settings.boringSidebarEnabled || settings.legacySidebarEnabled}
              onCheckedChange={(checked) =>
                updateSettings({
                  boringSidebarEnabled: Boolean(checked),
                  legacySidebarEnabled: false,
                })
              }
            />
          }
        />
        <SettingsRow
          {...searchableSetting("sidebar-pinned-only")}
          description="Show pinned parent threads in either sidebar view. Combines with Hide Inactive; subagents follow their parent's visibility."
          control={
            <Switch
              aria-label="Pinned Threads Only"
              checked={settings.sidebarPinnedOnlyEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ sidebarPinnedOnlyEnabled: Boolean(checked) })
              }
            />
          }
        />
        <SettingsRow
          {...searchableSetting("sidebar-hide-inactive")}
          description="Hide inactive threads and empty projects. Recent threads follow the retention settings below."
          control={
            <Switch
              aria-label="Hide Inactive"
              checked={settings.sidebarHideInactiveEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ sidebarHideInactiveEnabled: Boolean(checked) })
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
          {...searchableSetting("sidebar-visible-subagents")}
          description="Maximum number of subagents shown beneath each parent before Show More."
          control={
            <NumberField
              aria-label="Visible Subagents"
              size="sm"
              min={MIN_SIDEBAR_THREAD_PREVIEW_COUNT}
              max={MAX_SIDEBAR_THREAD_PREVIEW_COUNT}
              value={settings.sidebarSubagentPreviewCount}
              onValueChange={(value) => {
                if (value !== null)
                  updateSettings({
                    sidebarSubagentPreviewCount: Math.max(
                      MIN_SIDEBAR_THREAD_PREVIEW_COUNT,
                      Math.min(MAX_SIDEBAR_THREAD_PREVIEW_COUNT, Math.round(value)),
                    ),
                  });
              }}
            >
              <NumberFieldGroup>
                <NumberFieldDecrement aria-label="Fewer visible subagents" />
                <NumberFieldInput aria-label="Visible Subagents" />
                <NumberFieldIncrement aria-label="More visible subagents" />
              </NumberFieldGroup>
            </NumberField>
          }
        />
      </SettingsSection>
      <RecentThreadsSettings />
      <SettingsSection id="ajpemok-header" title="Header">
        <SettingsRow
          {...searchableSetting("ajpemok-header-scene")}
          description="Choose a Sydney scene for the sidebar header."
          control={
            <Select
              value={selectedScene.id}
              onValueChange={(id) => {
                if (
                  typeof id === "string" &&
                  AJPEMOK_HEADER_SCENES.some((scene) => scene.id === id)
                )
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
              onCheckedChange={(checked) =>
                updateSettings({ ajpemokHeaderMotion: Boolean(checked) })
              }
            />
          }
        />
      </SettingsSection>
      <SettingsSection id="ajpemok-context" title="Context and Usage">
        <SettingsRow
          {...searchableSetting("legacy-context-window-indicator")}
          description="Show context and token usage in the composer. Compact layouts keep the ring and hide the numbers."
          control={
            <Switch
              checked={settings.contextWindowMeterEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ contextWindowMeterEnabled: Boolean(checked) })
              }
              aria-label="Context and Token Usage"
            />
          }
        />
      </SettingsSection>
      <SettingsSection id="ajpemok-recording" title="Recording Pointer">
        <SettingsUnavailableGroup
          message={!isElectron ? "Only available in the desktop app." : undefined}
        >
          <RecordingPointerSettings disabled={!isElectron} />
        </SettingsUnavailableGroup>
      </SettingsSection>
      <SettingsSection id="ajpemok-improvements" title="Included Improvements">
        <ul className="list-disc space-y-2 ps-5 text-sm text-muted-foreground">
          <li>Project colours carry through thread activity, conversations and thread details.</li>
          <li>Model badges show provider and speed, with model and reasoning details on hover.</li>
          <li>Close All Inactive Tabs keeps tabs with active work or unsaved changes.</li>
          <li>
            Browser capture fits the viewport and supports hidden tabs and custom recording
            pointers.
          </li>
          <li>Codex retries temporary capacity errors with longer waits.</li>
        </ul>
      </SettingsSection>
    </SettingsPageContainer>
  );
}
