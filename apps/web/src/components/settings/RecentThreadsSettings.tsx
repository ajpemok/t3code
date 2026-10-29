import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { Switch } from "../ui/switch";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldDecrement,
  NumberFieldIncrement,
} from "../ui/number-field";

export function RecentThreadsSettings() {
  const settings = useScopedSettings();
  const update = useUpdateScopedSettings();
  return (
    <SettingsSection id="recent-threads" title="Completed Tasks">
      <SettingsRow
        {...searchableSetting("sidebar-recent-section")}
        description="Show recently finished threads in a separate Recent section."
        control={
          <Switch
            aria-label="Recent Section"
            checked={settings.sidebarRecentSectionEnabled}
            onCheckedChange={(value) => update({ sidebarRecentSectionEnabled: Boolean(value) })}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-today-section")}
        description="Show other tasks finished in the past 24 hours below Recent, with separate Threads and Subagents tabs."
        control={
          <Switch
            aria-label="Today Section"
            checked={settings.sidebarTodaySectionEnabled}
            onCheckedChange={(value) => update({ sidebarTodaySectionEnabled: Boolean(value) })}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-keep-recent")}
        description="Keep recent threads in the normal project list when Hide Inactive is on, including parents of recent subagents."
        control={
          <Switch
            aria-label="Keep Recent Threads Visible"
            checked={settings.sidebarKeepRecentThreadsVisible}
            onCheckedChange={(value) => update({ sidebarKeepRecentThreadsVisible: Boolean(value) })}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-recent-subagents")}
        description="Include finished subagents in Recent and Today when Show Subagents is on. Subagents have their own Recent limits."
        control={
          <Switch
            aria-label="Include Recent Subagents"
            checked={settings.sidebarRecentIncludeSubagents}
            onCheckedChange={(value) => update({ sidebarRecentIncludeSubagents: Boolean(value) })}
          />
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-recent-count")}
        description="Maximum number of finished threads to keep."
        control={
          <NumberField
            aria-label="Recent Thread Count"
            size="sm"
            min={1}
            max={50}
            value={settings.sidebarRecentThreadCount}
            onValueChange={(value) => {
              if (value !== null)
                update({ sidebarRecentThreadCount: Math.max(1, Math.min(50, Math.round(value))) });
            }}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label="Fewer recent threads" />
              <NumberFieldInput aria-label="Recent Thread Count" />
              <NumberFieldIncrement aria-label="More recent threads" />
            </NumberFieldGroup>
          </NumberField>
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-recent-age")}
        description="Maximum age in minutes. Set 0 to keep the last N finished threads regardless of age."
        control={
          <NumberField
            aria-label="Recent Thread Age Limit"
            size="sm"
            min={0}
            max={1440}
            step={5}
            value={settings.sidebarRecentThreadMaxAgeMinutes}
            onValueChange={(value) => {
              if (value !== null)
                update({
                  sidebarRecentThreadMaxAgeMinutes: Math.max(0, Math.min(1440, Math.round(value))),
                });
            }}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label="Shorter recent age limit" />
              <NumberFieldInput aria-label="Recent Thread Age Limit" />
              <NumberFieldIncrement aria-label="Longer recent age limit" />
            </NumberFieldGroup>
          </NumberField>
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-recent-subagent-count")}
        description="Maximum number of finished subagents to keep in Recent."
        control={
          <NumberField
            aria-label="Recent Subagent Count"
            size="sm"
            min={1}
            max={50}
            value={settings.sidebarRecentSubagentCount}
            onValueChange={(value) => {
              if (value !== null)
                update({
                  sidebarRecentSubagentCount: Math.max(1, Math.min(50, Math.round(value))),
                });
            }}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label="Fewer recent subagents" />
              <NumberFieldInput aria-label="Recent Subagent Count" />
              <NumberFieldIncrement aria-label="More recent subagents" />
            </NumberFieldGroup>
          </NumberField>
        }
      />
      <SettingsRow
        {...searchableSetting("sidebar-recent-subagent-age")}
        description="Maximum subagent age in minutes. Set 0 to keep the last N finished subagents regardless of age."
        control={
          <NumberField
            aria-label="Recent Subagent Age Limit"
            size="sm"
            min={0}
            max={1440}
            step={5}
            value={settings.sidebarRecentSubagentMaxAgeMinutes}
            onValueChange={(value) => {
              if (value !== null)
                update({
                  sidebarRecentSubagentMaxAgeMinutes: Math.max(
                    0,
                    Math.min(1440, Math.round(value)),
                  ),
                });
            }}
          >
            <NumberFieldGroup>
              <NumberFieldDecrement aria-label="Shorter recent subagent age limit" />
              <NumberFieldInput aria-label="Recent Subagent Age Limit" />
              <NumberFieldIncrement aria-label="Longer recent subagent age limit" />
            </NumberFieldGroup>
          </NumberField>
        }
      />
    </SettingsSection>
  );
}
