# Codex Prompt: UI/UX Upgrade for Project-Graveyard

## One-line context

Project-Graveyard is a local-first / offline-first desktop cemetery for abandoned side projects.

It scans a developer's local project folders, identifies projects that are alive, dormant, or dead, and lets users hold funerals, write epitaphs, archive projects, revive them later, and browse them inside a themed 3D graveyard.

The current product concept is strong, but the UI should become more memorable, more cinematic, and more suitable for GitHub README screenshots, demo GIFs, Twitter/X posts, 小红书封面, and other launch materials.

## Goal

Please improve the UI/UX so the product feels less like a generic management dashboard and more like a cozy, spooky, developer-themed cemetery for unfinished ideas.

Do not rewrite the core business logic. Focus on visual design, interaction design, information hierarchy, UI copy, and theme consistency.

## Design direction

Use this product personality:

```text
Cozy spooky developer game
```

The UI should feel:

- A little spooky, but not horror.
- Warm, playful, and developer-friendly.
- Local-first and trustworthy.
- Screenshot-worthy.
- More like a themed product experience than a CRUD dashboard.

Keep the app practical and readable. The theme should enhance usability, not obscure it.

## Important constraints

- Keep the app local-first and offline-first.
- Do not add telemetry, cloud sync, accounts, analytics, or AI API calls.
- Avoid large new dependencies unless absolutely necessary.
- Reuse existing React components, TypeScript types, styles, and i18n structure where possible.
- Preserve the existing Electron, React, and web demo behavior.
- All new user-facing copy should support English and Chinese.
- Do not break existing scanning, archive, funeral, revive, open, or recycle-bin flows.

## Files and areas to inspect first

Please inspect the current repository structure before editing. Pay special attention to:

- React renderer code
- 3D graveyard / cemetery view
- project detail drawer
- funeral modal
- sidebar / filters
- empty state
- list view
- i18n copy
- CSS / theme files
- day / night theme logic

---

# Required UI/UX changes

## 1. Add Showcase Mode / Cinematic Mode

### Goal

Create a clean, cinematic view specifically for GitHub README screenshots, demo GIFs, launch posts, Twitter/X, 小红书, and other promotional materials.

The current UI contains many useful controls, but it can look too much like a tool dashboard in screenshots. Showcase Mode should make the cemetery itself the hero.

### Requirements

Add a button such as:

```text
Showcase
Cinematic
```

When Showcase Mode is active, hide or visually de-emphasize:

- left sidebar
- advanced filters
- source filters
- dormant threshold controls
- excessive topbar buttons
- normal management UI chrome

Keep only:

- the main graveyard visual
- a simple title, such as `Project Memorial Garden`
- compact project stats, such as Alive / Dormant / Deceased
- a minimal hover or selected project info card
- a visible but unobtrusive `Exit Showcase` button

### Visual direction

Showcase Mode should:

- add cinematic spacing and breathing room
- work especially well in Night theme
- feel like a product poster rather than a control panel
- make the 3D graveyard more prominent
- be suitable for README hero screenshots

### Acceptance criteria

- Users can enter and exit Showcase Mode.
- Existing functionality is not broken.
- The UI in Showcase Mode is much cleaner than normal mode.
- A screenshot of Showcase Mode clearly communicates the product idea.

---

## 2. Strengthen visual differences between Alive / Dormant / Dead states

### Goal

The current states should not rely mainly on color. In screenshots, users should be able to understand the state of a project without reading text.

### Suggested visual language

Alive:

- not a full tombstone
- small garden bed, sprout, glowing seedling, open gate, or other life signal
- hopeful and active

Dormant / Sleeping:

- tilted tombstone
- faint glow
- cobwebs
- Zzz indicator
- half-asleep visual state

Dead / Buried:

- classic tombstone
- cracks
- nameplate
- dry grass
- darker and more final

### Requirements

- Add shape or silhouette differences, not just color differences.
- Keep the visual system coherent.
- Avoid overloading the scene with too many decorative elements.
- Maintain performance.

### Acceptance criteria

- Alive, dormant, and dead projects are visually distinct even in a static screenshot.
- The state visuals reinforce the cemetery metaphor.
- The scene remains readable and not visually noisy.

---

## 3. Redesign Funeral Modal as a ritual experience

### Goal

The Funeral Modal should become one of the most memorable interactions in the whole product. It should feel like a project funeral, death certificate, obituary, or tombstone creation ritual, not a generic form.

### Suggested structure

```text
DEATH CERTIFICATE

Project: old-blog-v2
Born: 2023-01-12
Last active: 2023-07-08

Cause of death
[Lost interest ▼]

Epitaph
[It worked on my machine.]

[Preview Tombstone]
[Hold Funeral]
```

### Requirements

- Rename or redesign the modal title to something more thematic, such as:
  - `Death Certificate`
  - `Hold a Funeral`
  - `Project Obituary`
  - Chinese: `死亡证明` / `举行葬礼` / `项目讣告`
- Add suggested epitaphs that users can click to fill in.
- Include both English and Chinese suggestions.
- Add a simple tombstone preview if feasible.
- Keep the original hold-funeral submit behavior intact.

### Suggested English epitaphs

```text
It worked on my machine.
Killed by scope creep.
Here lies another weekend idea.
README written. Product not found.
May the TODOs rest in peace.
Abandoned, but not forgotten.
```

### Suggested Chinese epitaphs

```text
它曾经在我电脑上跑起来过。
死于需求膨胀。
这里躺着又一个周末灵感。
README 写完了，产品没了。
愿 TODO 安息。
烂尾，但没有被遗忘。
```

### Acceptance criteria

- The modal feels special and on-theme.
- Users can quickly select or edit an epitaph.
- Chinese and English both work.
- Existing funeral logic still works.

---

## 4. Improve Project Detail Drawer information hierarchy

### Goal

The detail drawer should help new users quickly understand what a project is, where it is, and what they can do next. It should feel like a themed project record, not a dense admin detail page.

### First screen should prioritize

- project name
- path
- status
- lifecycle / last active information
- epitaph or unburied state
- primary actions:
  - Open
  - Hold Funeral
  - Revive
  - Archive

### Move secondary information into collapsible sections

- Technical details
- TODOs
- Last commit
- Stats
- Artifacts

### Add a Danger Zone

High-risk actions should be visually separated from everyday actions.

Move actions such as:

- Move to recycle bin
- delete-like actions

into a clear `Danger Zone` section.

### Acceptance criteria

- The top of the drawer is easy to scan.
- Dangerous actions are not mixed with normal actions.
- No existing information is removed; it is only reorganized.
- Existing actions continue to work.

---

## 5. Simplify Sidebar and add Advanced Controls

### Goal

The sidebar currently exposes many controls at once. This is useful for power users, but it can overwhelm first-time users.

### Default sidebar should show only

- Scan folder
- Add one project
- local-only / privacy reminder

### Move into `Advanced Controls`

- filters
- source filters
- dormant threshold
- other advanced settings

### Requirements

- Advanced controls should be collapsed by default.
- Existing filtering features must still work.
- The sidebar should emphasize trust:
  - local-first
  - no telemetry
  - no cloud
  - user-controlled scanning

### Acceptance criteria

- First-time UI feels lighter.
- Advanced users can still access the same controls.
- The sidebar has a clearer visual hierarchy.

---

## 6. Improve Empty State and fix i18n issues

### Goal

The empty state should feel like onboarding, not just a blank data state. It should also avoid mixed-language UI.

### Suggested English copy

```text
No projects rest here yet.
Choose a code folder and discover which side projects have gone quiet.
```

Three-step onboarding:

```text
1. Scan your project folders
2. Find dormant projects
3. Bury or revive them
```

### Suggested Chinese copy

```text
这里还没有项目安息。
选择一个代码目录，看看哪些 side project 已经沉睡太久。
```

Three-step onboarding:

```text
1. 扫描你的项目目录
2. 找出沉睡太久的项目
3. 安葬它们，或让它们复活
```

### Requirements

- Check all empty-state text, privacy reminders, buttons, and labels.
- Ensure user-facing strings go through i18n.
- Avoid Chinese text appearing in English mode or English-only text in Chinese mode unless intentional.
- Make the empty state emotionally aligned with the product.

### Acceptance criteria

- English and Chinese modes both look polished.
- The empty state explains what to do next.
- The empty state reinforces the cemetery concept.

---

## 7. Unify the visual system

### Goal

The app should not feel partly like a game and partly like an admin dashboard. The entire UI should share one coherent visual language.

### Direction

Use:

```text
Cozy spooky developer game
```

### Suggested style rules

- Use consistent border radii, for example 12 / 16 / 24.
- Use consistent panel treatment, preferably hand-painted or game-like panels.
- Make buttons feel like themed game UI buttons.
- Use decorative or serif-style typography for major headings where appropriate.
- Use monospace font for paths, technical metadata, and code-related fields.
- Make cards, drawers, modals, dropdowns, and list rows feel like they belong to the same product.

### Acceptance criteria

- The app feels visually unified.
- Cemetery view, list view, drawer, modal, and sidebar belong to the same design system.
- The UI remains readable and practical.

---

## 8. Redesign List View as Archive Ledger

### Goal

If the current list view looks like a generic data table, reframe it as a themed archive ledger.

### Requirements

- Rename or visually frame it as `Archive Ledger`.
- Make each row feel like a project record or archive entry, not a normal CRUD table row.
- Keep information scannable:
  - project name
  - path
  - status
  - tech stack
  - last active
  - actions
- Use themed status badges:
  - Alive
  - Sleeping
  - Buried
- Add a subtle archive / ledger / parchment feeling if it fits the current theme.
- Do not reduce usability.

### Acceptance criteria

- List View no longer feels like a generic admin table.
- It still works well for scanning many projects.
- It visually matches the rest of the cemetery theme.

---

## 9. Make Day / Night themes emotionally distinct

### Goal

Day and Night should not feel like simple color swaps. They should support different usage contexts.

### Night theme

Use Night as the more cinematic, screenshot-friendly theme.

It should emphasize:

- moonlight
- glow
- cemetery atmosphere
- hover cards
- tombstone contrast
- README / Showcase visuals

### Day theme

Use Day as the practical management theme.

It should emphasize:

- readability
- comfortable contrast
- clearer panels
- longer work sessions

### Requirements

- Do not break existing theme switching.
- Showcase Mode should look especially strong in Night theme.
- Day theme should remain clean and usable.

### Acceptance criteria

- The two themes feel meaningfully different.
- Night theme is better for promotional screenshots.
- Day theme is better for everyday management.

---

# Testing and quality checks

After changes, please run if available:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If any command cannot run due to environment limitations, clearly state which command failed and why.

# Final response format

When done, summarize:

1. Files changed
2. New UI/UX capabilities added
3. Whether existing functionality was affected
4. How to manually verify the changes
5. What could be improved in a follow-up PR

# Implementation priority

Please prioritize in this order:

1. Showcase Mode
2. Funeral Modal ritual redesign
3. Visual state differences for Alive / Dormant / Dead
4. Sidebar simplification with Advanced Controls
5. Detail Drawer hierarchy and Danger Zone
6. Empty State and i18n cleanup
7. Archive Ledger list view
8. Day / Night theme polish

If the full scope is too large for one pass, implement the first three items well and leave clear TODO notes for the rest.
