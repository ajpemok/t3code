# Fork Changes

This is the maintained inventory relative to the official base in [upstream.json](upstream.json).
It describes the resulting behaviour, including tests and assets; Git retains the individual commit history.
Refresh it whenever the base or fork changes.
Paths below are relative to the repository root.
Some files serve more than one group.

## Native Browser Viewport and Zoom

- Apply fixed browser dimensions to the native Chromium guest and preserve CSS viewport size at non-default zoom.
- Clear the override for Fill, serialise viewport changes, restore rejected state and reapply after guest or debugger replacement.
- Wait for guest measurements when restoring viewport-dependent controls, including the current colour scheme.
- Keep page metrics available through the server/browser abstraction after upstream changes.

| Files                                                 | Fork Responsibility                                             |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `apps/desktop/src/preview/DesktopBrowserHost.ts`      | Native viewport and zoom application, measurement and clearing. |
| `apps/desktop/src/preview/DesktopBrowserHost.test.ts` | Focused native-host fixtures.                                   |
| `apps/desktop/src/preview/Manager.ts`                 | Per-tab viewport intent, lifecycle ordering and restoration.    |
| `apps/desktop/src/preview/Manager.test.ts`            | Lifecycle, viewport, zoom and restoration regressions.          |
| `apps/desktop/src/ipc/channels.ts`                    | Desktop preview method registration.                            |
| `apps/desktop/src/ipc/methods/preview.ts`             | Preview IPC method implementation.                              |
| `apps/desktop/src/preload.ts`                         | Renderer access to the desktop preview bridge.                  |
| `packages/contracts/src/ipc.ts`                       | Shared preview IPC contract.                                    |
| `apps/web/src/browser/HostedBrowserWebview.tsx`       | Hosted guest viewport integration.                              |
| `apps/server/src/preview/ServerBrowserPage.ts`        | Browser page metrics access.                                    |
| `apps/server/src/preview/ServerBrowser.ts`            | Server integration and request deadlines.                       |
| `apps/server/src/preview/ServerBrowser.test.ts`       | Viewport integration and timeout regressions.                   |

Resolve conflicts across the contract, preload, host, manager and webview together.
Preserve the guest's current zoom, `deviceScaleFactor: 0`, `mobile: false`, Fill clearing and serialised writes.
After a wait, validate the current guest and committed controls again before applying them.
An accepted resize request or cached viewport value does not prove that the guest resized.

## Browser Request Deadlines

`apps/server/src/preview/ServerBrowser.ts` and `apps/server/src/preview/ServerBrowser.test.ts` also contain the repair that bounds stalled requests without closing a shared browser host.
Keep upstream initial-navigation timeout reporting alongside local timeout containment.
They address different failure modes, even when their names sound similar.
Propagate request cancellation through snapshot and recording-start waits so a stalled capture releases the server queue. Dispose of late encoder/session allocations and prevent a late seed frame from starting a recording. Keep the desktop host's physical screenshot serialisation: overlapping native captures can crash Chromium.
`apps/server/src/preview/ServerBrowserPage.ts` also prevents cancelled snapshots from starting a late capture, retrying or publishing refs.
When upstream changes Effect cancellation or page ownership, verify that timing out one operation leaves unrelated tabs and the shared host usable.

## Antigravity Quota Request Identity

| Files                                                     | Fork Responsibility                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/server/src/provider/antigravityUsageLimits.ts`      | Use `antigravity/hub/2.24.0` in the quota request User-Agent instead of `1.0.0`. |
| `apps/server/src/provider/antigravityUsageLimits.test.ts` | Request-header and fractional-quota regression coverage.                         |

Keep the current upstream request identity if it already includes or supersedes this repair.
This fork does not include the earlier experimental quota-source merge, freshness changes or local quota exporter.
Synthetic parsing/header checks do not establish live quota accuracy.

## Project Colour and Activity

- Tint the main conversation header, right panel and project/task rows with the project's colour.
- Keep scratch and draft threads neutral when there is no project.
- Use stronger dark-mode contrast, smooth active/idle colour transitions and distinct bounded Working, Waiting, Computer, Browser and T3 Browser effects. Pause them offscreen, when hidden and with reduced motion.
- Use flat task bands with gaps; preserve the existing Working label and elapsed time.

| Files                                                   | Fork Responsibility                                             |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/web/src/projectIdentity.ts`                       | Shared project-colour presentation.                             |
| `apps/web/src/projectIdentity.test.ts`                  | Project identity regressions.                                   |
| `apps/web/src/components/ChatView.tsx`                  | Null-safe project colour and right-panel wiring.                |
| `apps/web/src/components/RightPanelTabs.tsx`            | Pass the project colour to the panel shell.                     |
| `apps/web/src/components/preview/PreviewPanelShell.tsx` | Tint all supported right-panel layouts.                         |
| `apps/web/src/components/Sidebar.tsx`                   | Flat sidebar colour and activity integration.                   |
| `apps/web/src/components/sidebar/SidebarThreadRow.tsx`  | Task presentation, working state and interaction frame.         |
| `apps/web/src/components/ui/combobox.tsx`               | Explicit project-row colour variant.                            |
| `apps/web/src/components/ui/sidebar.tsx`                | Explicit edge-to-edge group inset option.                       |
| `apps/web/src/index.css`                                | Colour/contrast tokens, idle treatment, tree guides and motion. |

Resolve colours through existing project identity and theme tokens rather than hard-coded light-mode fills.
Keep null guards in `ChatView`; drafts previously crashed when reading `project.color` without a project.
Scope component variants to their callers so upstream menus and uncoloured rows retain their normal appearance.

## Collapsible Project Sections

- Reuse T3's existing legacy sidebar grouping and saved collapse state, exposed through the Project Sections setting.
- Show active/waiting/idle state with a coloured indicator; preserve the original thread status text.
- Put the indicator at the far right and replace it with pin/new controls on hover or keyboard focus.
- Pin or unpin eligible project threads together. Explicit project pins retain empty headers; settled, effectively snoozed and archived tasks stay outside the project trees.
- Keep the tree guide stable during expansion and use the project colour.
- Offer New thread in empty project sections through the existing project/environment handler.

| Files                                                            | Fork Responsibility                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/src/components/LegacySidebar.tsx`                      | Group headers, collapse, project pinning, empty action and cleanup menu. |
| `apps/web/src/components/Sidebar.logic.ts`                       | Project activity and eligible-thread derivation.                         |
| `apps/web/src/components/Sidebar.logic.test.ts`                  | Activity and pin eligibility fixtures.                                   |
| `apps/web/src/components/settings/AjpemokAppearanceSettings.tsx` | Project Sections, scene and motion controls.                             |
| `apps/web/src/components/settings/AppearanceSettingsPanel.tsx`   | Appearance settings integration.                                         |
| `apps/web/src/components/settings/SettingsPanels.tsx`            | Settings controls and context-usage integration.                         |
| `apps/web/src/components/settings/settingsSearch.ts`             | Searchable setting labels and descriptions.                              |
| `packages/contracts/src/settings.ts`                             | Header setting defaults/patch schema and context-meter default.          |
| `docs/user/project-settings.md`                                  | Current project controls.                                                |
| `docs/user/thread-sidebar.md`                                    | Sections, activity, cleanup and usage guidance.                          |

Preserve upstream project/environment permissions, native thread commands, settled-state rules and saved settings.
Keep project-header pin intent in client settings and task pins in the native thread commands.
Keep status above the timestamp on the right, idle rows on one line and hover actions in that same area.
Preserve the shared native task menu, bulk actions and Settle shortcut.
Bottom-align Snoozed and Settled shelves using their existing saved expansion keys.
Remote-environment metadata belongs beside the project name.

| Files                                                                    | Fork Responsibility                                                                                      |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/sidebar/ProjectThreadShelves.tsx`               | Bottom-aligned Snoozed/Settled shelves, native restore commands and second-precise snooze wakes.         |
| `apps/web/src/components/sidebar/ProjectThreadShelves.browser.test.tsx`  | Restore, permissions, interruption and snooze-boundary behaviour.                                        |
| `apps/web/src/components/sidebar/ActiveSubagentThreads.tsx`              | Saved toolbar toggle and active children from quiet shell state, with no child transcript subscriptions. |
| `apps/web/src/components/sidebar/ActiveSubagentThreads.browser.test.tsx` | Toggle, completion/removal, input requests and environment separation.                                   |
| `apps/web/src/components/sidebar/SidebarThreadHeader.tsx`                | Flat-view subagent toggle.                                                                               |
| `apps/web/src/components/RelativeTime.tsx`                               | Optional now label for grouped metadata.                                                                 |
| `apps/web/src/components/threadActionMenu.logic.ts`                      | Shared counted task cleanup item.                                                                        |
| `apps/web/src/components/threadActionMenu.logic.test.ts`                 | Task cleanup count and read-only behaviour.                                                              |
| `packages/contracts/src/settings.test.ts`                                | New client preference round trips.                                                                       |

| Files                                                    | Fork Responsibility                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/hooks/useCanSnoozeThread.ts`               | Share the native queued-turn snooze gate across both task layouts.                |
| `apps/web/src/hooks/useCanSnoozeThread.browser.test.tsx` | Reopen the gate without another shell update and block pending input.             |
| `apps/web/src/lib/visibleAnimation.browser.test.tsx`     | Verify offscreen, hidden-document and reduced-motion pauses and observer cleanup. |

## Sydney Header and Wordmark

- Replace the sidebar title with AJPEMOK, with A/MOK differentiated from JPE and no extra logo before it.
- Offer twelve Sydney scenes, defaulting to Copper Skyline.
- Use brief hover/focus and idle light sweeps; pause effects for hidden/unfocused windows and honour reduced motion.

| Files                                                              | Fork Responsibility                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `apps/web/src/components/sidebar/SidebarChrome.tsx`                | AJPEMOK wordmark and header integration.                        |
| `apps/web/src/components/sidebar/AjpemokBackdrop.tsx`              | Scene rendering and bounded motion.                             |
| `apps/web/src/components/sidebar/AjpemokBackdrop.browser.test.tsx` | Header rendering and motion fixtures.                           |
| `apps/web/src/components/sidebar/ajpemokHeaderScenes.ts`           | Scene IDs, labels, imports and fallback.                        |
| `apps/web/src/components/SidebarStageBackdrop.tsx`                 | Remove the unused wrapper; retain stage artwork used elsewhere. |

All twelve tracked header images are under `apps/web/src/assets/ajpemok/`:

```text
blue-hour.webp
copper-skyline.webp
electric-harbour.webp
emerald-harbour.webp
harbour-lights.webp
harbour-mist.webp
midnight-ink.webp
moonlit-ferry.webp
rain-on-the-harbour.webp
rose-dawn.webp
terracotta-dusk.webp
violet-afterglow.webp
```

Keep scene IDs stable so saved choices survive updates.
When upstream changes branding, preserve its stage detection and update channel while applying the fork's sidebar treatment.
Keep effects intermittent and avoid continuous repainting.

## Computer and Browser Use Indicators

| Files                                                           | Fork Responsibility                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web/src/lib/threadSurfaceUse.ts`                          | Classify current running tool activity, including both T3 MCP prefixes. |
| `apps/web/src/lib/threadSurfaceUse.test.ts`                     | Classifier regressions.                                                 |
| `apps/web/src/components/sidebar/ThreadSurfaceUseIndicator.tsx` | Compact tool indicator.                                                 |

The sidebar integration reads quiet current-run data only for visible running threads and releases unused leases.
Preserve that bounded subscription when upstream changes thread projections.
An open tab or retained browser ownership alone does not mean a tool is running.
Opaque wrappers can remain unclassified; avoid fabricating activity from missing metadata.

## Close Inactive Panel Tabs

| Files                                                             | Fork Responsibility                                                          |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/web/src/lib/inactivePanelTabs.ts`                           | Determine closable project tabs and the menu count.                          |
| `apps/web/src/lib/inactivePanelTabs.test.ts`                      | Selection, task, pending-work and resource exclusions.                       |
| `apps/web/src/hooks/useCloseInactiveProjectTabs.ts`               | Recheck candidates and close resources before removing their UI.             |
| `apps/web/src/hooks/useCloseInactiveProjectTabs.browser.test.tsx` | Cleanup through the real hook/store while preserving another project's view. |

Project, task and active-subagent menus offer Close all inactive tabs (N), matching the sentence case of adjacent actions.
Task cleanup is scoped by environment and thread ID; it leaves parent and sibling views alone.
Preserve the selected tab, active tasks, pending input/approval/background work, controlled or recording browsers, unsaved files and terminals.
Recheck immediately before each close.
Await the existing browser close RPC before removing its tab; a failed close retains the tab.
This action does not delete files or stop development servers, emulators or terminal processes.
Memory reclamation depends on the existing resource lifecycle and has not been measured.

## Context, Token and Weekly Quota Usage

| Files                                                              | Fork Responsibility                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `apps/web/src/components/chat/ContextWindowMeter.tsx`              | Context percentage, available token counts and detailed usage popover. |
| `apps/web/src/components/chat/ContextWindowMeter.browser.test.tsx` | Rendered usage and missing-data cases.                                 |

The existing context-meter setting defaults on when omitted; an explicit saved choice remains authoritative.
Display the reported processed-token count, falling back to context tokens when a processed total is unavailable.
Keep input, cached input, output and reasoning counts separate where the provider reports them.
Do not sum overlapping categories or invent totals, capacity or telemetry for an unsupported provider.
Settings, search and documentation changes are listed with the project-section files above.

The disabled compaction action remains visible as Compact Unavailable, with its reason in a tooltip.
Remove the old explanatory paragraphs without removing reported usage figures.

| Files                                                            | Fork Responsibility                                                                                            |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/chat/ChatComposer.tsx`                  | Follow the selected provider instance and model.                                                               |
| `apps/web/src/components/chat/ComposerFooterControls.tsx`        | Put the weekly remaining gauge immediately after context usage.                                                |
| `apps/web/src/components/chat/WeeklyQuotaGauge.tsx`              | Remaining fuel gauge with reset/check details and an unavailable state.                                        |
| `apps/web/src/components/chat/WeeklyQuotaGauge.browser.test.tsx` | Account switching, reported zero and failed-probe rendering.                                                   |
| `apps/web/src/lib/weeklyQuota.ts`                                | Exact account/workspace matching, weekly model buckets and five-minute freshness limit.                        |
| `apps/web/src/lib/weeklyQuota.test.ts`                           | Numeric, identity, model, missing-data and freshness boundaries.                                               |
| `apps/web/src/assets/brave.svg`                                  | Browser glyph from [Brave's official assets](https://brave.com/static-assets/images/brave-logo-sans-text.svg). |

Do not replace unavailable quota with a full gauge, use another account or infer a weekly window.
The gauge reads existing native/source snapshots without probing credentials.
Source failures and elapsed reset clocks invalidate the reading.

## Fork Maintenance Files

| Files                            | Fork Responsibility                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `.ajpemok/README.md`             | Refresh procedure, conflict resolution, packaging and recovery.              |
| `.ajpemok/CHANGES.md`            | This complete behaviour/file inventory.                                      |
| `.ajpemok/upstream.json`         | Official base identity and fork destination.                                 |
| `AGENTS.md`                      | Conditional pointer to the fork guide.                                       |
| `.github/scripts/ci-changes.cjs` | Treat only these three maintenance files as inert for package-job selection. |

Keep the CI exception restricted to these documentation/metadata names.
Future scripts or application configuration under `.ajpemok` must receive their normal checks.
Runtime state, private evidence, credentials, model files and generated installers remain outside tracked source.
The independent Stream Deck plugin and ComfyStudio work are outside this patch set.
Floating-browser behaviour was left unchanged after the user found the existing setting.

## Focused Checks

Use `vp test run <file>` for the relevant existing tests listed above and affected-package `typecheck` scripts after conflicts.
Read the current package names/scripts instead of copying a stale command list.

| Changed Area                    | Additional Behaviour to Check                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native browser lifecycle or IPC | Portrait/landscape, Fill, non-default zoom, guest replacement and current colour scheme. Check actual guest metrics. Recording needs an explicit capture resolution. |
| Browser deadlines               | A stalled navigation times out while an unrelated tab and the shared browser host remain usable.                                                                     |
| Quota identity/parsing          | Header and parser fixtures. Live accuracy requires a separate authorised provider comparison.                                                                        |
| Project UI or header            | Light/dark themes, project-less drafts, collapsed/expanded groups, hover/focus, active/waiting/idle states and reduced motion.                                       |
| Cleanup or tool activity        | Both sidebars, pending work, resource-close failure, project boundaries and both T3 tool prefixes.                                                                   |
| Settings or context usage       | Default and saved choices, schema patch fields, search, missing usage and reported zero counts.                                                                      |

Source checks, mocked fixtures, rendered browser tests, native Electron execution and installed-app acceptance establish different things.
Record the level actually checked in the private handoff.
