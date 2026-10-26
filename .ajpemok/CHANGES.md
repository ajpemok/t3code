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

## Native Capture and Recording Pointers

Capture-active parked guests must remain composited. Chromium can cull a negative
stacking layer even with throttling disabled. Keep the renderer activity handshake,
temporary paintable placement and native layout-metrics lease together. Release
the lease after physical capture completion; a broker timeout cannot cancel a
Chromium screenshot copy. Retain screenshot serialisation and viewport restoration.

Keep upstream's focus and painting ownership for hidden tabs. The
rendering handshake complements those holds; it must survive until physical
capture completes or the last screencast viewer leaves. One viewer closing must
not release another viewer's rendering lease.

Agent recordings use the reported pointer configuration and mouse-press preference.
Desktop screencasts supply CSS viewport width separately from native DIP width so
pointer placement survives zoom and Fill resizing. Seed frames use measured width.
Paint the initial frame before starting the encoder. Presets are ordinary arrows
and a precision ring; preserve custom PNG import, size, hotspot and halo settings.

| Files                                                                        | Fork Responsibility                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/browser/browserSurfaceStore.ts`                                | Owned capture activity leases and renderer paint acknowledgement.    |
| `apps/web/src/browser/hostedBrowserWebviewStyle.ts`                          | Paintable placement during capture, with normal parking afterwards.  |
| `apps/web/src/browser/BrowserProfileReporter.tsx`                            | Report recording preferences to connected environments.              |
| `apps/web/src/browser/browserRecording.ts`                                   | Apply pointer and halo configuration to desktop recordings.          |
| `apps/web/src/browser/recordingCompositor.ts`                                | Configured click halo colour, radius and duration.                   |
| `apps/desktop/src/preview/RecordingInput.ts`                                 | Recording pointer input options.                                     |
| `apps/desktop/src/preview/RecordingCursor.ts`                                | Custom/preset pointer image and hotspot in guest coordinates.        |
| `apps/desktop/src/preview/PickPreload.ts`                                    | Pass native recording appearance to the guest.                       |
| `apps/server/src/preview/ServerBrowserPage.test.ts`                          | Decode video and verify the custom pointer hotspot.                  |
| `packages/contracts/src/preview.ts`                                          | Bounded pointer preferences and backward-compatible profile reports. |
| `packages/shared/src/recordingPointer.ts`                                    | Shared preset geometry and image generation.                         |
| `packages/shared/package.json`                                               | Shared recording-pointer subpath.                                    |
| `apps/web/src/components/settings/RecordingPointerSettings.tsx`              | Presets, image import, numeric controls and click preview.           |
| `apps/web/src/components/settings/RecordingPointerSettings.browser.test.tsx` | Image import, numeric editing, preset selection and reset.           |
| `apps/web/src/components/settings/IntegrationsSettings.tsx`                  | Recording configuration entry point.                                 |
| `docs/user/browser-recordings.md`                                            | Recording and custom-pointer workflow.                               |

## Confirm Window Close

After the final panel or terminal closes, Ctrl+W/Command+W asks before closing the
desktop window. Cancel is the default. Coalesce repeated close requests and retain
the updater/explicit quit teardown path.

| Files                                           | Fork Responsibility                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/desktop/src/window/DesktopWindow.ts`      | Owned native close confirmation and platform-specific session wording. |
| `apps/desktop/src/window/DesktopWindow.test.ts` | Cancel, confirm and repeated-close behaviour.                          |
| `docs/user/keybindings.md`                      | Explain closing the final view/window.                                 |

## Antigravity Quota Request Identity

| Files                                                     | Fork Responsibility                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/server/src/provider/antigravityUsageLimits.ts`      | Use `antigravity/hub/2.24.0` in the quota request User-Agent instead of `1.0.0`. |
| `apps/server/src/provider/antigravityUsageLimits.test.ts` | Request-header and fractional-quota regression coverage.                         |

Keep the current upstream request identity if it already includes or supersedes this repair.
This fork does not include the earlier experimental quota-source merge, freshness changes or local quota exporter.
Synthetic parsing/header checks do not establish live quota accuracy.

## Project Colour and Activity

- Tint the main conversation header, right panel and project/thread rows with the project's colour.
- Give the conversation a faint project wash; Thread Details uses the full project-section tint in both its inline and popover layouts.
- Keep scratch and draft threads neutral when there is no project.
- Use stronger dark-mode contrast, smooth active/idle colour transitions and distinct bounded Working, Waiting, Computer, Browser and T3 Browser effects. Pause them offscreen, when hidden and with reduced motion.
- Use flat task bands with gaps; preserve the existing Working label and elapsed time.
- Use the project accent for Working, Goals and snooze times in both sidebars, with a softer shade for subagents and the theme accent when there is no project colour.

| Files                                                   | Fork Responsibility                                                 |
| ------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/projectIdentity.ts`                       | Shared project-colour presentation.                                 |
| `apps/web/src/projectIdentity.test.ts`                  | Project identity regressions.                                       |
| `apps/web/src/components/ChatView.tsx`                  | Null-safe project colour and right-panel wiring.                    |
| `apps/web/src/components/chat/ThreadDetailsPanel.tsx`   | Carry project identity into both details presentations.             |
| `apps/web/src/components/chat/ThreadDetailsCard.tsx`    | Apply the full project tint to the details card, including portals. |
| `apps/web/src/components/RightPanelTabs.tsx`            | Pass the project colour to the panel shell.                         |
| `apps/web/src/components/preview/PreviewPanelShell.tsx` | Tint all supported right-panel layouts.                             |
| `apps/web/src/components/Sidebar.tsx`                   | Flat sidebar colour and activity integration.                       |
| `apps/web/src/components/sidebar/SidebarThreadRow.tsx`  | Task presentation, working state and interaction frame.             |
| `apps/web/src/components/ui/combobox.tsx`               | Explicit project-row colour variant.                                |
| `apps/web/src/components/ui/sidebar.tsx`                | Explicit edge-to-edge group inset option.                           |
| `apps/web/src/index.css`                                | Colour/contrast tokens, idle treatment, tree guides and motion.     |

Resolve colours through existing project identity and theme tokens rather than hard-coded light-mode fills.
Keep null guards in `ChatView`; drafts previously crashed when reading `project.color` without a project.
Scope component variants to their callers so upstream menus and uncoloured rows retain their normal appearance.

Recognise explicit browser APIs in CUA/Node JavaScript calls, including MCP-prefixed
tool names. Browser activity refines generic computer metadata; owning a browser
tab or mentioning one in prose does not count as activity.

| Files                                       | Fork Responsibility                               |
| ------------------------------------------- | ------------------------------------------------- |
| `packages/shared/src/toolActivity.ts`       | Recognise browser and computer REPL calls.        |
| `packages/shared/src/toolActivity.test.ts`  | Browser API and unrelated JavaScript regressions. |
| `apps/web/src/lib/threadSurfaceUse.ts`      | Refine current running tool metadata.             |
| `apps/web/src/lib/threadSurfaceUse.test.ts` | Activity, completion and metadata precedence.     |

Compacting uses the theme's error accent. Derive it from a running compaction in
the active run, in both shell readers, so completed or older work cannot keep it lit.

| Files                                                      | Fork Responsibility                                        |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/client-runtime/src/state/models.ts`              | Preserve compaction activity for all shell consumers.      |
| `packages/contracts/src/orchestrationV2.ts`                | Optional compaction activity in the shared shell contract. |
| `apps/server/src/orchestration-v2/ProjectionStore.test.ts` | Memory and SQL compaction lifecycle and run isolation.     |

## Thread Opening Position

Open ordinary threads at their measured end, preserving disclosure choices.
Search and citation navigation retain priority, and manual navigation cancels
positioning. Re-enable live following on a thread switch without inheriting an
earlier reading position. Keep the bounded settlement and late-layout maintenance.

| Files                                                            | Fork Responsibility                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| `apps/web/src/components/chat/MessagesTimeline.tsx`              | End positioning on initial mount and thread changes.                |
| `apps/web/src/components/chat/MessagesTimeline.browser.test.tsx` | Reopen, content growth, composer inset and manual-scroll behaviour. |
| `apps/web/src/components/chat/useTimelinePositionRestore.ts`     | Measured initial settlement and explicit-navigation priority.       |
| `apps/web/src/components/chat/useTimelineFollow.ts`              | Restore live following on thread switches.                          |

## Collapsible Project Sections

- Reuse T3's existing legacy sidebar grouping and saved collapse state, exposed through the Project Sections setting.
- Show active/waiting/idle state with a coloured indicator; preserve the original thread status text.
- Put the indicator at the far right and replace it with pin/new controls on hover or keyboard focus.
- Pin or unpin eligible project threads together. Explicit project pins retain empty headers; settled, effectively snoozed and archived tasks stay outside the project trees.
- Keep the tree guide stable during expansion and use the project colour.
- Offer New thread in empty project sections through the existing project/environment handler.

| Files                                                            | Fork Responsibility                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/web/src/components/LegacySidebar.tsx`                      | Group headers, collapse, project pinning, empty action and cleanup menu.     |
| `apps/web/src/components/Sidebar.logic.ts`                       | Project activity and eligible-thread derivation.                             |
| `apps/web/src/components/Sidebar.logic.test.ts`                  | Activity and pin eligibility fixtures.                                       |
| `apps/web/src/components/settings/AjpemokAppearanceSettings.tsx` | Project Sections, scene and motion controls.                                 |
| `apps/web/src/components/settings/AppearanceSettingsPanel.tsx`   | Appearance settings integration.                                             |
| `apps/web/src/components/settings/SettingsPanels.tsx`            | Settings controls and context-usage integration.                             |
| `apps/web/src/components/settings/settingsSearch.ts`             | Searchable setting labels and descriptions.                                  |
| `apps/web/src/components/settings/settingsSearch.test.ts`        | Exact command searches remain distinct from newly added visibility commands. |
| `packages/contracts/src/settings.ts`                             | Header setting defaults/patch schema and context-meter default.              |
| `docs/user/project-settings.md`                                  | Current project controls.                                                    |
| `docs/user/thread-sidebar.md`                                    | Sections, activity, cleanup and usage guidance.                              |

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
| `apps/web/src/components/sidebar/SidebarActivityCounts.tsx`              | Active/inactive thread and subagent summaries with compact project-header layout.                        |
| `apps/web/src/components/RelativeTime.tsx`                               | Optional now label for grouped metadata.                                                                 |
| `apps/web/src/components/threadActionMenu.logic.ts`                      | Shared counted task cleanup item.                                                                        |
| `apps/web/src/components/threadActionMenu.logic.test.ts`                 | Task cleanup count and read-only behaviour.                                                              |
| `packages/contracts/src/settings.test.ts`                                | New client preference round trips.                                                                       |
| `packages/contracts/src/keybindings.ts`                                  | Assignable inactive-thread and subagent visibility commands.                                             |
| `packages/contracts/src/keybindings.test.ts`                             | Preserve both visibility commands when decoding keybindings.                                             |
| `apps/web/src/components/AppSidebarLayout.tsx`                           | Dispatch toolbar, menu and keyboard visibility changes.                                                  |
| `apps/web/src/components/ReopenClosedViewShortcut.tsx`                   | Forward visibility shortcuts from native guest browsers.                                                 |
| `apps/web/src/components/files/BrowserDocumentFrame.tsx`                 | Forward visibility shortcuts from document frames.                                                       |
| `apps/web/src/components/settings/KeybindingsSettings.logic.ts`          | Discoverable visibility command names.                                                                   |

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
| `apps/web/src/components/usage/UsageLimitDetails.tsx`            | Shared account usage details and native reset-credit action.                                                   |
| `apps/web/src/components/usage/UsageLimitsPooled.tsx`            | Usage page reuses the same details component as the composer.                                                  |
| `scripts/effect-budget.json`                                     | Existing fork observer, native guest synchronisation and snooze timer effects under upstream's effect budget.  |
| `apps/web/src/assets/brave.svg`                                  | Browser glyph from [Brave's official assets](https://brave.com/static-assets/images/brave-logo-sans-text.svg). |

Do not replace unavailable quota with a full gauge, use another account or infer a weekly window.
The gauge reads existing native/source snapshots without probing credentials.
Source failures and elapsed reset clocks invalidate the reading.
Read the current selected-instance snapshot even when the composer retains an older
provider object after a check-time-only update. Merge banked reset reports only for
that account and workspace. Use native reset routing and confirmation, and dismiss
the confirmation on an account change. Hide stale or expired balances. The raised
counter uses the active theme's information colour within 48 hours and warning
colour within 24 hours. The important state also has a tinted badge and stronger
weight, with a subtle opacity pulse paused offscreen, when hidden and with reduced motion.

## Steering After Compaction and Stale Delegated Activity

Allow steering and completion delivery after a manual compaction finishes and a goal
continues in another provider turn within the same run. Keep the maintenance guard
for unfinished compaction and sign-out. Read only the compaction items needed by
the command policy alongside the existing bounded command projection.

| Files                                                                     | Fork Responsibility                                                               |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/server/src/orchestration-v2/CommandPolicy.ts`                       | Current provider-turn maintenance guard.                                          |
| `apps/server/src/orchestration-v2/CommandPolicy.test.ts`                  | Continued goals, unfinished compaction and attempt isolation.                     |
| `apps/server/src/orchestration-v2/Orchestrator.ts`                        | Normal dispatch, queued promotion and completion delivery use the same guard.     |
| `apps/server/src/orchestration-v2/SteeringCompletion.integration.test.ts` | Direct and queued steering continue without restarting provider work.             |
| `packages/shared/src/orchestrationV2PendingBackgroundWork.ts`             | Later completed work on a child supersedes legacy stale activity for that child.  |
| `packages/shared/src/orchestrationV2PendingBackgroundWork.test.ts`        | Same-child, terminal-status and rollback boundaries.                              |
| `apps/server/src/orchestration-v2/ProjectionStore.ts`                     | Matching SQL shell and settlement reads, using the existing thread/ordinal index. |
| `apps/server/src/orchestration-v2/ProjectionSettlement.test.ts`           | Memory and SQL parity for superseded activity.                                    |

These changes derive current activity without rewriting old task results or live history.

## Provider Error Recovery

Retry reported temporary provider and transport failures through the server scheduler,
with a saved limit of three by default, capped at five. Use increasing delays and
durable continuation message IDs. Keep the original message and queued work intact.
Cancel, Stop, a changed provider/model, pending input, active native provider work,
newer runs and the normal thread lifecycle must prevent stale retries. Revalidate
the source run and current settings inside the serialised command before dispatch.
Old failures and permanent or usage-limit failures retain their own recovery paths.

| Files                                                                 | Fork Responsibility                                                    |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/shared/src/orchestrationV2ThreadError.ts`                   | Temporary-failure policy, bounded retry chain and deadlines.           |
| `packages/shared/src/orchestrationV2ThreadError.test.ts`              | Limits, stable identities, stale readings and permanent failures.      |
| `packages/contracts/src/settings.ts`                                  | Per-environment retry limit and Off value.                             |
| `packages/contracts/src/settings.test.ts`                             | Default, bounds and disabled setting.                                  |
| `packages/contracts/src/orchestrationV2.ts`                           | Cancellation marker and guarded automatic continuation.                |
| `packages/client-runtime/src/operations/commands.ts`                  | Send cancellation through the protected metadata command.              |
| `packages/client-runtime/src/state/models.ts`                         | Preserve cancellation across shell updates.                            |
| `apps/server/src/orchestration-v2/ProviderErrorRecoveryWorker.ts`     | Scheduled, idempotent recovery with no client timer.                   |
| `apps/server/src/orchestration-v2/ProjectionStore.ts`                 | Bounded candidate reads and native-work/Stop guards.                   |
| `apps/server/src/orchestration-v2/ProjectionStore.test.ts`            | SQL/memory candidate, lifecycle and native-work parity.                |
| `apps/server/src/orchestration-v2/Orchestrator.ts`                    | Commit-time validation, cancellation and manual Resume.                |
| `apps/server/src/orchestration-v2/runtimeLayer.ts`                    | Register the worker with the existing scheduler.                       |
| `apps/server/src/orchestration-v2/runtimeLayer.test.ts`               | Retry, cancellation races, duplicates and queued-message preservation. |
| `apps/server/src/orchestration-v2/ProviderTurnControlService.test.ts` | Updated projection-service fixture.                                    |
| `apps/web/src/components/ChatView.tsx`                                | Current-thread recovery and manual Resume availability.                |
| `apps/web/src/components/chat/ProviderErrorRecoveryBanner.tsx`        | Countdown and permission-aware cancellation.                           |
| `apps/web/src/components/settings/SettingsPanels.tsx`                 | Scoped retry limit, mixed values and restore defaults.                 |
| `apps/web/src/components/settings/settingsSearch.ts`                  | Discoverable recovery setting.                                         |

Only advertise automatic recovery when the connected environment reports the
capability. Older or official servers must not show a countdown for a worker they lack.

| Files                                                   | Fork Responsibility                                          |
| ------------------------------------------------------- | ------------------------------------------------------------ |
| `packages/contracts/src/environment.ts`                 | Optional recovery capability for older-server compatibility. |
| `packages/contracts/src/environment.test.ts`            | Preserve missing capabilities and explicit support.          |
| `apps/server/src/environment/ServerEnvironment.ts`      | Advertise the installed worker.                              |
| `apps/server/src/environment/ServerEnvironment.test.ts` | Verify the server reports recovery support.                  |

## Wake Indicators and Window Resizing

Grouped rows use the same snooze-wake calculation and acknowledgement command as
the flat view. Keep Woke until visited or dismissed. Its brief alarm effect settles
to a static clock and pauses with the other activity effects.

Give window-width changes to an open inline side panel, preserving the conversation
width within existing size limits. Closed, sheet and maximised panels must not
accumulate viewport deltas. Sidebar drags still update the size cap. Persist divider
adjustments at drag end rather than writing preferences on every window resize.

| Files                                                           | Fork Responsibility                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------ |
| `apps/web/src/components/Sidebar.logic.ts`                      | Shared Woke presentation and activity priority.              |
| `apps/web/src/components/Sidebar.logic.test.ts`                 | Wake acknowledgement and settled-thread regression.          |
| `apps/web/src/components/LegacySidebar.tsx`                     | Grouped wake dismissal through native visitation.            |
| `apps/web/src/components/sidebar/SidebarThreadRow.tsx`          | Flat alarm presentation in both row layouts.                 |
| `apps/web/src/components/sidebar/ThreadSurfaceUseIndicator.tsx` | Wake symbol and optional acknowledgement control.            |
| `apps/web/src/index.css`                                        | Bounded wake animation and static reduced-motion state.      |
| `apps/web/src/hooks/usePreviewPanelInlineSize.ts`               | Viewport measurements and mode changes.                      |
| `apps/web/src/hooks/useResizableWidth.ts`                       | Apply viewport deltas without changing other width controls. |
| `apps/web/src/hooks/usePreviewPanelInlineSize.browser.test.tsx` | Window resize, closed-panel and reopen regression.           |
| `apps/web/src/components/chat/ChatRightPanel.tsx`               | Enable window-edge resizing only for the open inline panel.  |
| `apps/web/src/components/preview/PreviewPanelShell.tsx`         | Match enabled state in standalone panel callers.             |

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
