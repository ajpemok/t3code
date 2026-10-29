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
| `apps/web/src/browser/BrowserProfileReporter.ts`                             | Report recording preferences through the client lifecycle.           |
| `apps/web/src/browser/BrowserProfileReporter.test.ts`                        | Re-report pointer and click preferences without profile changes.     |
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
| `docs/user/browser-recordings.md`                                            | Recording and custom-pointer workflow.                               |

## Antigravity Quota Request Identity

| Files                                                     | Fork Responsibility                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/server/src/provider/antigravityUsageLimits.ts`      | Use `antigravity/hub/2.24.0` in the quota request User-Agent instead of `1.0.0`. |
| `apps/server/src/provider/antigravityUsageLimits.test.ts` | Request-header and fractional-quota regression coverage.                         |

Keep the current upstream request identity if it already includes or supersedes this repair.
This fork does not include the earlier experimental quota-source merge, freshness changes or local quota exporter.
Synthetic parsing/header checks do not establish live quota accuracy.

## AJP3 Fork Settings

Group custom controls under **Settings → AJP3 Fork**: sidebar layout and filters,
subagent visibility/count, Recent threads, header, context usage and recording pointers.
Keep saved preference keys, sidebar shortcuts and desktop-only recording restrictions.
Search and old anchored links lead to the new page. Standard browser recording controls
remain upstream-owned in Browser settings. List automatic improvements without adding
switches to disable correctness repairs.

| Files                                                        | Fork Responsibility                                           |
| ------------------------------------------------------------ | ------------------------------------------------------------- |
| `apps/web/src/components/settings/AjpemokSettingsPanel.tsx`  | Custom controls and included improvements.                    |
| `apps/web/src/routes/_chat.settings.ajpemok.tsx`             | Dedicated settings route.                                     |
| `apps/web/src/routeTree.gen.ts`                              | Generated route registration.                                 |
| `apps/web/src/components/settings/SettingsSidebarNav.tsx`    | Fork navigation icon.                                         |
| `apps/web/src/components/settings/SettingsScopeSentence.tsx` | Keep client preferences independent of environment selection. |
| `apps/web/src/components/settings/SettingsPanels.tsx`        | Move fork controls out of the legacy group.                   |
| `apps/web/src/components/settings/settingsSearch.ts`         | Search labels, destinations and old anchored links.           |
| `apps/web/src/components/settings/settingsSearch.test.ts`    | Search routing and link relocation regressions.               |

## Project Colour and Activity

- Tint the main conversation header, right panel and project/thread rows with the project's colour.
- Give the conversation a faint project wash; Thread Details uses the full project-section tint in both its inline and popover layouts.
- Keep scratch and draft threads neutral when there is no project.
- Use stronger dark-mode contrast, smooth active/idle colour transitions and distinct bounded Working, Waiting, Computer, Browser and T3 Browser effects. Pause them offscreen, when hidden and with reduced motion.
- Use flat task bands with gaps; keep elapsed time visible and status text in hover details.
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
| `packages/client-runtime/src/state/models.ts`              | Preserve the compacting display flag for shell consumers.  |
| `packages/client-runtime/src/state/entities.test.ts`       | Runless native activity presentation and completion.       |
| `packages/contracts/src/orchestrationV2.ts`                | Optional compaction activity in the shared shell contract. |
| `apps/server/src/orchestration-v2/ProjectionStore.test.ts` | Memory and SQL compaction lifecycle and run isolation.     |

## Collapsible Project Sections

- Reuse upstream project folders, collapse state and keyboard navigation through the Project Sections setting. Retire the deleted legacy sidebar.
- Show active/waiting/idle state with a coloured indicator and keep status text in hover details.
- Keep upstream's one-line/two-line folder setting; add branch and PR metadata in the two-line variant.
- Keep the pin beside the project icon in folders, cards and shelves. Fill pinned icons with the project accent; leave unpinned icons outlined. Keep New Thread on hover or keyboard focus.
- Reserve aligned provider, speed, action and time columns across normal, snoozed and settled rows. Keep snooze clocks fixed when labels differ and preserve positions on hover; reduce the detail column at compact widths.
- Right-align model names with timestamps. Nested subagents share the row inset and responsive detail columns; their titles and dismiss buttons shrink separately.
- Pin or unpin eligible project threads together. Explicit project pins retain empty headers; settled, effectively snoozed and archived tasks stay outside the project trees.
- Keep the tree guide stable during expansion and use the project colour.
- Offer New thread in empty project sections through the existing project/environment handler.
- Offer Pinned Threads Only in both views and Settings. Combine it with Hide Inactive, keep subagents under eligible parents and preserve the Snoozed/Settled shelves.
- Hide empty project sections under Pinned Only; a project pin must not bypass the thread filters.

| Files                                                            | Fork Responsibility                                                  |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/web/src/components/Sidebar.tsx`                            | Shared flat/folder filters, project pinning and native shelves.      |
| `apps/web/src/components/sidebar/SidebarProjectFolderHeader.tsx` | Project colour, pin control and activity counts on upstream folders. |
| `apps/web/src/components/sidebar/SidebarPinButton.tsx`           | Shared, always-visible pin control and accent treatment.             |
| `apps/web/src/components/Sidebar.logic.ts`                       | Project activity and eligible-thread derivation.                     |
| `apps/web/src/components/Sidebar.logic.test.ts`                  | Activity and pin eligibility fixtures.                               |
| `packages/contracts/src/settings.ts`                             | Header setting defaults/patch schema and context-meter default.      |
| `docs/user/project-settings.md`                                  | Current project controls.                                            |
| `docs/user/thread-sidebar.md`                                    | Sections, activity, cleanup and usage guidance.                      |

Preserve upstream project/environment permissions, native thread commands, settled-state rules and saved settings.
Keep project-header pin intent in client settings and task pins in the native thread commands.
Keep status above the timestamp on the right, idle rows on one line and hover actions in that same area.
Preserve the shared native task menu, bulk actions and Settle shortcut.
Bottom-align Snoozed and Settled shelves using their existing saved expansion keys.
Remote-environment metadata belongs beside the project name.

Show/Hide accepts legacy saved `active` values as Show; Hide Inactive supplies the
shared active-only filter.
Pinned Only uses a filled primary button while enabled. Activity counts stay in
project headers rather than the top toolbar.
Nested subagent rows keep a two-line status area centred in a taller row, with
extra indentation and separation from their parent. Parent and child model columns share the same compact width.

| Files                                                                    | Fork Responsibility                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/sidebar/ProjectThreadShelves.tsx`               | Bottom-aligned Snoozed/Settled shelves, native restore commands and second-precise snooze wakes.                                      |
| `apps/web/src/components/sidebar/ProjectThreadShelves.browser.test.tsx`  | Restore, permissions, interruption and snooze-boundary behaviour.                                                                     |
| `apps/web/src/components/sidebar/ActiveSubagentThreads.tsx`              | Saved Show/Hide toggle, shared inactive filter and limited child rows from quiet shell state, without child transcript subscriptions. |
| `apps/web/src/components/sidebar/ActiveSubagentThreads.browser.test.tsx` | Toggle, completion/removal, input requests and environment separation.                                                                |
| `apps/web/src/components/sidebar/SidebarThreadHeader.tsx`                | Flat-view subagent toggle.                                                                                                            |
| `apps/web/src/components/sidebar/SidebarActivityCounts.tsx`              | Active/inactive thread and subagent summaries with compact project-header layout.                                                     |
| `apps/web/src/components/RelativeTime.tsx`                               | Optional now label for grouped metadata.                                                                                              |
| `apps/web/src/components/threadActionMenu.logic.ts`                      | Shared counted task cleanup item.                                                                                                     |
| `apps/web/src/components/threadActionMenu.logic.test.ts`                 | Task cleanup count and read-only behaviour.                                                                                           |
| `packages/contracts/src/settings.test.ts`                                | New client preference round trips.                                                                                                    |
| `packages/contracts/src/keybindings.ts`                                  | Assignable inactive-thread, pinned-only and subagent visibility commands.                                                             |
| `packages/contracts/src/keybindings.test.ts`                             | Preserve visibility commands when decoding keybindings.                                                                               |
| `apps/web/src/components/AppSidebarLayout.tsx`                           | Dispatch toolbar, menu and keyboard visibility changes.                                                                               |
| `apps/web/src/components/ReopenClosedViewShortcut.tsx`                   | Forward visibility shortcuts from native guest browsers.                                                                              |
| `apps/web/src/components/files/BrowserDocumentFrame.tsx`                 | Forward visibility shortcuts from document frames.                                                                                    |
| `apps/web/src/components/settings/KeybindingsSettings.logic.ts`          | Discoverable visibility command names.                                                                                                |

| Files                                                    | Fork Responsibility                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/web/src/hooks/useCanSnoozeThread.ts`               | Share the native queued-turn snooze gate across both task layouts.                |
| `apps/web/src/hooks/useCanSnoozeThread.browser.test.tsx` | Reopen the gate without another shell update and block pending input.             |
| `apps/web/src/lib/visibleAnimation.browser.test.tsx`     | Verify offscreen, hidden-document and reduced-motion pauses and observer cleanup. |

## Recent Finished Threads

Both sidebars have Recent and Today shelves, each with independent Threads and
Subagents tabs. Today sits below Recent and lists other completions from the past
24 hours. Settled threads and their descendants stay exclusively in Settled.
Recent has independent thread and subagent
count/age limits, each defaulting to five within sixty minutes; a zero age limit
keeps the last N regardless of age. Separate client
preferences control the shelf, normal-list retention under Hide Inactive and
including subagents. Subagents still respect Show/Hide. Preserve ancestor
visibility so a recent child remains reachable. Pinned Only applies to the
parent, and parked/archived threads or descendants stay out of Recent.
Use completion metadata, including the native terminal shell status for runless
children. A running or input-blocked thread leaves Recent and follows normal
activity filtering. Share the bounded quiet-shell derivation across rows; no
transcript subscription or server mutation is needed for this client view.
Recent entries and retained subagents can be dismissed individually, with Undo
and a restore action in Recent. Dismissal is local to the client and completion;
a later completed turn can appear again. Keep the optional normal-list retention.
Today excludes Recent and dismissed completions without extending normal-list retention.
Read omitted idle children of unsettled threads through native family reads
after opening a Subagents tab, keeping those
reads until the shelf collapses. Do not subscribe to transcripts for these shelves.

| Files                                                                 | Fork Responsibility                                                           |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apps/web/src/components/sidebar/recentThreads.logic.ts`              | Completion ordering, count/age bounds, exclusions and ancestor keys.          |
| `apps/web/src/components/sidebar/recentThreads.logic.test.ts`         | Boundaries, parking, native children, environments and normal-list retention. |
| `apps/web/src/hooks/useRecentThreads.ts`                              | Shared quiet-shell derivation, saved preferences and minute clock.            |
| `apps/web/src/hooks/useCompletedThreadHistory.ts`                     | Scoped on-demand subagent-family reads, excluding settled parents.            |
| `apps/web/src/components/sidebar/RecentThreadsShelf.tsx`              | Shared Recent section, collapse, links and existing context actions.          |
| `apps/web/src/components/sidebar/RecentThreadDismissButton.tsx`       | Shared dismissal action for Recent and retained child rows.                   |
| `apps/web/src/components/sidebar/RecentThreadsShelf.browser.test.tsx` | Collapse, finished-thread display and removal on resume.                      |
| `apps/web/src/components/settings/RecentThreadsSettings.tsx`          | Shelf, retention, subagent, count and age controls.                           |

## Read-Only Model Details

Working and Goal statuses include a compact model name. The shared hover/focus
card shows the full model, provider and available reasoning/speed options. The
badge follows the active run's settings. If the composer has different selected
settings, the card shows them separately under Next Turn. While the active run's
settings load, do not display the next-turn speed as its running speed. Finished runs do not
override the current selection. Speed uses the option
value, so provider display labels cannot change its meaning. Unknown model
or option values stay visible rather than being replaced by catalog defaults.
Root rows reuse their visible detail lease; child rows load details only while
the card is open. Grouped, flat and subagent rows share model presentation.
Provider icons also appear on idle rows and Recent entries. Reuse existing flat
row icons instead of duplicating them. Fast, Priority and Ultrafast modes show a
lightning bolt; Standard and unreported speed remain distinct in the hover card.
Idle icon rows must not acquire transcript leases before hover or focus.

| Files                                                                 | Fork Responsibility                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/web/src/components/sidebar/ThreadModelDetails.tsx`              | Shared model badge, read-only fields and bounded detail subscription. |
| `apps/web/src/components/sidebar/threadModelDetails.logic.ts`         | Run/provider model choice and catalog display labels.                 |
| `apps/web/src/components/sidebar/threadModelDetails.logic.test.ts`    | Run settings, Standard/Fast and unavailable/stale catalog cases.      |
| `apps/web/src/components/sidebar/ThreadModelDetails.browser.test.tsx` | Hover details and no child detail lease before opening.               |

## AJP3 Fork Icon

Use the selected pink/blue A3 monogram with an integrated fork for nightly desktop
packages and web favicons. Keep the existing app ID, installation name, data home,
version and update channel so official nightlies and fork builds replace one another.
Native mobile and development icons retain their upstream assets.

Display AJP3 Fork in desktop branding, window/About names, the web shell and web-app
manifest. Retain channel labels, Electron's internal storage name and the token-safe
native User-Agent format. macOS localises the visible bundle name to AJP3 Fork.
Keep the unlocalised name equal to the physical bundle name so Finder and Dock
accept the localisation; the path and ID stay stable.

| Files                                             | Fork Responsibility                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scripts/lib/brand-assets.ts`                     | Select fork assets through the existing nightly packaging paths.              |
| `scripts/build-desktop-artifact.ts`               | macOS display metadata with stable package identity.                          |
| `apps/desktop/resources/ajp3/InfoPlist.strings`   | Localised Finder and Dock name with the original bundle filename.             |
| `apps/desktop/src/app/DesktopEnvironment.ts`      | Desktop display name and unchanged channel selection.                         |
| `apps/desktop/src/app/DesktopAppIdentity.ts`      | Stable Electron storage name alongside fork display branding.                 |
| `apps/desktop/src/app/DesktopAppIdentity.test.ts` | Runtime/About names, valid User-Agent token and stable app ID.                |
| `apps/web/src/branding.ts`                        | Web branding fallback.                                                        |
| `apps/web/index.html`                             | Initial page and splash labels.                                               |
| `apps/web/public/manifest.webmanifest`            | Installed web-app name with unchanged web identity.                           |
| `.ajpemok/sign-macos.cjs`                         | Pinned local signing identity, staged nested code and preserved entitlements. |
| `.ajpemok/sign-macos-session.cjs`                 | One-shot logged-in-session signing for SSH builds, with bounded cleanup.      |
| `assets/a3-fork/icon-1024.png`                    | Selected artwork and shared macOS/Linux source.                               |
| `assets/a3-fork/icon-windows.ico`                 | Windows renditions from 16 to 256 pixels.                                     |
| `assets/a3-fork/favicon.ico`                      | Web 16/32-pixel ICO.                                                          |
| `assets/a3-fork/favicon-16x16.png`                | Small browser favicon.                                                        |
| `assets/a3-fork/favicon-32x32.png`                | Browser favicon.                                                              |
| `assets/a3-fork/apple-touch-180.png`              | Web touch icon.                                                               |

## Sydney Header and Wordmark

- Replace the sidebar title with AJP3 Fork, with a stronger AJP3 and no extra logo before it.
- Offer twelve Sydney scenes, defaulting to Copper Skyline.
- Use brief hover/focus and idle light sweeps; pause effects for hidden/unfocused windows and honour reduced motion.

| Files                                                              | Fork Responsibility                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `apps/web/src/components/sidebar/SidebarChrome.tsx`                | Fork wordmark and header integration.                           |
| `apps/web/src/components/sidebar/AjpemokBackdrop.tsx`              | AJP3 Fork wordmark, scene rendering and bounded motion.         |
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

| Files                                                           | Fork Responsibility                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/lib/threadSurfaceUse.ts`                          | Classify live tools, retain external computer/browser use through the turn and expire other recent surface calls.  |
| `apps/web/src/lib/threadSurfaceUse.test.ts`                     | Surface, completion, ownership and recent-activity regressions.                                                    |
| `apps/web/src/components/sidebar/ThreadSurfaceUseIndicator.tsx` | Shared live/recent indicators, native control state and one-shot ending effects.                                   |
| `apps/web/src/browser/ServerBrowserSurface.tsx`                 | Report existing stream control and disconnect events to the client preview state.                                  |
| `apps/web/src/previewStateStore.ts`                             | Retain known agent control when a viewer detaches; clear it on takeover, close, disconnect and server replacement. |
| `apps/web/src/components/preview/usePreviewSession.ts`          | Keep known active browser sessions subscribed while their visible sidebar row is in the background.                |
| `apps/web/src/previewStateStore.test.ts`                        | Multiple viewers, environment isolation, close and replacement regressions.                                        |

The sidebar integration reads quiet current-run data only for visible running threads and releases unused leases.
Preserve that bounded subscription when upstream changes thread projections.
Specific browser, computer or device activity replaces the generic Working glyph in one fixed slot. Viewer cleanup on task selection must not clear session ownership.
An agent-controlled T3 browser or open device session keeps its surface visible
only while that thread is running. Successful external computer/browser calls retain
the latest surface for that running turn, labelled Use This Turn between live calls.
Other completed surface calls remain for five seconds with a Recent label and one
short ending effect; a newer action resets that deadline. Use the existing deadline store, control events and device
subscription. Do not add polling or treat arbitrary open tabs as agent activity.
Reduced motion disables the ending effect; hidden and offscreen effects pause.
Opaque wrappers can remain unclassified; avoid fabricating activity from missing metadata.
Use the composer's Standard default and let an explicit speed choice override
provider reports across the Fast and service-tier option names. Keep provider
and speed glyphs immediately before the model name. Status words belong in the
hover card; centre the icon/model/time column across the full row. Align remote
and branch metadata beneath the title, with shared 14-pixel row glyphs.

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
An idle provider session alone must not protect every tab. Check runtime activity,
active run ownership and compaction separately from the Working shelf label.
Recheck immediately before each close.
Await the existing browser close RPC before removing its tab; a failed close retains the tab.
This action does not delete files or stop development servers, emulators or terminal processes.
Memory reclamation depends on the existing resource lifecycle and has not been measured.

## Context, Token and Weekly Quota Usage

Upstream 3867 adds an optional Usage section in thread details. Keep its Labs
setting independent of the fork's composer context and weekly quota controls.

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

## Compacting Status

Report a running compaction in the shell for the active run only, then clear it
when that item completes. This is display metadata; steering and native-child
activity use upstream behaviour.

| Files                                                      | Fork Responsibility                                    |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `apps/server/src/orchestration-v2/ProjectionStore.ts`      | Current-run compaction state in memory and SQL shells. |
| `apps/server/src/orchestration-v2/ProjectionStore.test.ts` | Matching list and per-thread shell status.             |
| `packages/contracts/src/orchestrationV2.ts`                | Optional compacting indicator.                         |
| `packages/client-runtime/src/state/models.ts`              | Preserve the reported indicator for the client.        |

## Codex Capacity Backoff

Keep upstream's capacity recovery in the Codex adapter and append waits of
60, 120, 180, 240, 480 and 960 seconds after its five quick retries. Stop still
cancels the wait, and exhaustion ends the turn after 11 retries. Preserve upstream's
empty-input continuation, root-turn restriction and compaction exclusion.
The separate fork provider retry worker remains retired.

| Files                                                              | Fork Responsibility                              |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| `apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts`      | Extended capacity retry delays in upstream code. |
| `apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.test.ts` | Full schedule, exhaustion and recovery coverage. |

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
| `apps/web/src/components/sidebar/SidebarThreadRow.tsx`          | Flat alarm presentation in both row layouts.                 |
| `apps/web/src/components/sidebar/ThreadSurfaceUseIndicator.tsx` | Wake symbol and optional acknowledgement control.            |
| `apps/web/src/index.css`                                        | Bounded wake animation and static reduced-motion state.      |
| `apps/web/src/hooks/usePreviewPanelInlineSize.ts`               | Viewport measurements and mode changes.                      |
| `apps/web/src/hooks/useResizableWidth.ts`                       | Apply viewport deltas without changing other width controls. |
| `apps/web/src/hooks/usePreviewPanelInlineSize.browser.test.tsx` | Window resize, closed-panel and reopen regression.           |
| `apps/web/src/components/chat/ChatRightPanel.tsx`               | Enable window-edge resizing only for the open inline panel.  |
| `apps/web/src/components/preview/PreviewPanelShell.tsx`         | Match enabled state in standalone panel callers.             |

## T3 Connect Packaging

AJPEMOK desktop builds require upstream's public T3 Connect configuration.
Set `T3CODE_DESKTOP_REQUIRE_CONNECT=1` when packaging. Reject missing public
identifiers, a missing Electron sign-in module and bundles from a different
configuration, including when reusing build output. Local-only upstream builds
remain available without that opt-in. Account credentials stay outside builds.

| Files                                    | Fork Responsibility                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `scripts/build-desktop-artifact.ts`      | Opt-in validation of emitted T3 Connect support and public configuration. |
| `scripts/build-desktop-artifact.test.ts` | Offline, configured, missing-module and stale-configuration bundle cases. |
| `scripts/lib/public-config.ts`           | Export the shared resolver for fork packaging validation.                 |

## Project Folder

Use the existing environment-level Project Folder preference for both Add Project
browsing and newly created repositories. Resolve `~` on the destination server.
Read the setting for each creation; changing it does not relocate existing projects
or scratch folders. Keep the current managed-project root when the setting is empty.
Publish the resolved root in initial config and settings updates so connected web,
desktop and mobile clients update previews without reconnecting. The additive update
field is optional for older servers. Agent, scheduler and CLI creation use the same service.

| Files                                                              | Fork Responsibility                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `apps/server/src/project/ManagedProjectFolders.ts`                 | Resolve configured roots and create named projects there.                |
| `apps/server/src/project/ManagedProjectFolders.test.ts`            | Tilde expansion, live changes, reset and scratch separation.             |
| `apps/server/src/ws.ts`                                            | Resolved root in initial config, live updates and late editor snapshots. |
| `apps/server/src/ws.test.ts`                                       | Buffered config updates retain the matching resolved root.               |
| `packages/contracts/src/server.ts`                                 | Optional resolved-root field on settings updates.                        |
| `packages/client-runtime/src/state/serverConfigProjection.ts`      | Merge current roots while preserving older-server compatibility.         |
| `packages/client-runtime/src/state/serverConfigProjection.test.ts` | Immediate root updates and absent-field compatibility.                   |
| `apps/web/src/components/settings/SettingsPanels.tsx`              | Explain the folder preference's browsing and creation scope.             |
| `apps/web/src/components/settings/settingsSearch.ts`               | Discoverable Project Folder label and original search terms.             |
| `docs/user/project-settings.md`                                    | Folder selection and remote-home behaviour.                              |

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

3877 adds configurable thread-details rows and moves undo notices into the sidebar footer.
Keep those upstream controls alongside the fork project tint and custom settings page.
The configured project folder also coexists with upstream scratch-thread promotion.

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
