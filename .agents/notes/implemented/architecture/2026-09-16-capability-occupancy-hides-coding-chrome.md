# Agent Note: Capability occupancy hides coding chrome

Status: implemented

English | [中文](2026-09-16-capability-occupancy-hides-coding-chrome.zh.md)

## Problem

A Q&A overlay can disable coding plugins, but several conversation controls stay on screen because the shells that own them always render. The composer plus button, the hero workspace chip, the grouped Workspace tree, the Settings control, and the right-sidebar expand control do not read whether their capability is present, so a composition that removed commands, directory picking, settings pages, and page tab types still looked like a coding IDE.

Client plugin `config` in an overlay YAML does not reach the browser: `bootClient` constructs each roster row as `loader.create({ name })` with no config object. Overlay-only flags therefore cannot hide those controls without first-party shell changes.

## Decision

**Conversation chrome follows capability occupancy, not a kiosk flag.** Official coding compositions keep the same buttons. A Q&A overlay hides them by omitting the plugins that occupy the holes, plus one host plugin that registers the remaining cwd workspace so New Session has a target.

The composer plus button renders only while `toggleCommandMenu` is composed. Disabling `ui-commands` together with every `commandUi` consumer leaves that callback undefined, and InputBar omits the launcher.

The hero workspace row (chip, directory-flow menu, agent-preset hole) renders only while `conversation.hero.workspace.directoryFlow` has an occupant. `ui-conversation` publishes that occupancy as `hooks.canAddWorkspace`. Disabling the host `directory-picker` row leaves the hole empty, so the chip never appears and the no-Session composer is not a workspace picker. While that hole is empty, ConversationContent attaches an existing Workspace (latest activity, then creation time) so the composer can accept input. A KnowEmp overlay inserts `knowemp-workspace`, which calls `workspaceRegistry.create(process.cwd())` so New Session and this auto-connect have a target.

Host `watchNavigation` waits for the first Workspace when both lists are ready but empty, instead of giving up; a cwd plugin that creates the roster after first reconcile still receives the initial connect.

While `sidebar.workspaces.directoryFlow` is empty, WorkspaceBrowser renders the flat Session list and omits grouping choices. It does not rewrite persisted `groupBy`, so restoring a directory picker restores the saved grouping.

The Settings control is the occupant of `sidebar.settings`. Disabling `ui-settings-general` leaves that seat empty and the sidebar paints no foot control. Keep `ui-settings` (the domain). Disabling `ui-settings-models` and `ui-settings-unarchive-sessions` drops the unreachable pages.

The right-sidebar expand button renders only while a registered tab type is not the guide. The guide stays registered because `ui-chat` injects `sidebarRight`. Disabling `ui-sidebar-files`, `ui-sidebar-terminal`, and `ui-sidebar-documentpreview` leaves only the guide, and ExpandButton returns null.

These rules are documented on `ui-conversation`, `ui-workspace`, `ui-sidebar`, and `ui-sidebar-right`. The KnowEmp overlay lists the disabled rows and the cwd workspace plugin; it does not add Client YAML config for chrome.

## Alternatives considered

**Add Client `Config` flags such as `hideWorkspaceChip`.** Rejected because `bootClient` does not pass overlay config into the browser roster, so the flags would not work until that loader contract changed.

**Disable `ui-sidebar-right` or `ui-workspace`.** Rejected because `ui-chat` injects `sidebarRight` and will not mount without it, and Sessions still need a workspace target for New Session.

**Disable `ui-settings`.** Rejected because feature rows still inject the settings domain; only the `sidebar.settings` occupant (`ui-settings-general`) paints the trigger.

**Mutate `settings.agent-presets.modeSelectionEnabled` in `$DSH_HOME`.** Rejected because that file is shared with coding presets on the same machine.

**Auto-select a Workspace from ConversationContent while a directory picker is composed.** Rejected because the picker is the connect gesture. An empty directory-flow hole auto-connects because the composer is no longer a picker.

**Rewrite persisted `groupBy` to `flat` when the directory-flow hole is empty.** Rejected because a later coding composition should keep the user's saved grouping.

## Consequences

- A coding composition that still mounts commands, a directory picker, settings-general, or a page tab type keeps the corresponding chrome.
- A Q&A overlay must disable the occupying plugins and ensure a cwd workspace; disabling only the tools leaves the buttons.
- Context meter, sidebar New Session / brand, and the DeepSeek fish hero remain; they have no occupancy signal in this change.
- Disabling `ui-settings-general` also removes in-app connection recovery and the Settings panel; model choice moves to `.env` / `$DSH_HOME/settings.yaml`.
- [Right Sidebar docking](../feature/2026-09-04-right-sidebar-docking-infrastructure.md) still owns the expand button's seat; this note owns when that seat paints nothing.

## Testing

`ui-conversation` omits the launcher when `toggleCommandMenu` is undefined, hides the hero chip whenever directory-flow occupancy is false, auto-connects an existing Workspace in that case, and reports `canAddWorkspace` false until a picker occupies the hole. `ui-workspace` forces the flat Session list and hides grouping items when the sidebar directory-flow hole is empty, without changing persisted `groupBy`; initial navigation still connects a Workspace that appears after an empty ready roster. `ui-sidebar-right` ExpandButton is null when only the guide type is registered.
