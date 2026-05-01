# nav2md Task Plan

## Goal

Build the MVP of `nav2md`: a Chrome extension that lets the user select left-side docs navigation items in-page, then sequentially export the selected docs pages as Markdown files inside a zip archive with a `manifest.json`.

## Current Status

- Phase 1: Repository bootstrap and project skeleton — in_progress
- Phase 2: Extension selection-mode foundation — in_progress
- Phase 3: Export job orchestration and extraction pipeline — in_progress
- Phase 4: Zip export, manifest, and progress UI — in_progress
- Phase 5: Validation on representative docs sites — pending
- Phase 6: Shift box selection shortcut — complete

## Key Decisions

- Product shape is a Chrome extension, not a bookmarklet.
- Selection interaction is `slicer`-style and happens in-page.
- User manually selects navigation targets in the MVP.
- Export jobs visit selected pages one by one.
- Extraction is docs-container-first, not Readability-first.
- Zip output is flat markdown files plus `manifest.json`.

## Deliverables

- Chrome extension scaffold with manifest and scripts
- In-page docs-nav selection overlay
- Background export queue
- Docs content extractor
- Markdown conversion and zip packaging
- `manifest.json` generation
- Basic validation notes for representative docs sites

## Phase Breakdown

### Phase 1: Repository Bootstrap and Project Skeleton

- Decide stack and build tooling
- Create extension project structure
- Add baseline scripts, linting, and build flow
- Confirm extension loads in Chrome dev mode

Progress notes:

- Chose a zero-build native Chrome extension skeleton for the first vertical slice to reduce startup friction.
- Added `manifest.json`, a service worker entry, a content script entry, overlay styles, and a README load path.
- Static validation passed for `manifest.json`.
- Added real no-dependency validation scripts for manifest parsing and JavaScript syntax checks.
- Remaining Phase 1 check: load the unpacked extension in Chrome and confirm the action toggles the page overlay.
- Migrated the runtime to TypeScript and Vite after dependencies were installed manually.
- `npm run build` now emits a loadable `dist` directory.
- Remaining Phase 1 check: load `dist` in Chrome and confirm the action toggles the page overlay.

### Phase 2: Extension Selection-Mode Foundation

- Implement service worker action toggle
- Inject content script into docs pages
- Build left-nav candidate detection
- Add hover, select, deselect, and selected-item state
- Add minimal in-page overlay controls

Progress notes:

- Action click now toggles selection mode through the service worker.
- Content script injects an overlay panel and hover highlight box.
- Candidate detection currently prefers anchor-based targets.
- Multi-select, deselect, selected-count display, and selected-item list are in place.
- `Start export` now converts selections into normalized task payloads and sends them to the background worker.
- Remaining Phase 2 check: validate real docs-site behavior in Chrome and tighten candidate filtering for left-nav-heavy layouts.
- Candidate detection now filters toward nav/sidebar/left-column links and avoids obvious body-only links.

### Phase 3: Export Job Orchestration and Extraction Pipeline

- Normalize selected items into export tasks
- Build sequential capture job in background
- Open and reuse capture tab
- Wait for page readiness and run extractor
- Extract docs main content container and clean UI noise
- Convert cleaned content to Markdown

Progress notes:

- Added a reusable capture-tab flow in the background runtime.
- Added a page-context docs extractor with ordered content-root heuristics.
- Markdown generation now uses Turndown inside the page extraction step.

### Phase 4: Zip Export, Manifest, and Progress UI

- Create deterministic filename generation
- Aggregate results and failures
- Generate `manifest.json`
- Package zip and trigger download
- Surface progress and final counts in UI

Progress notes:

- Replaced the temporary no-dependency zip generator with JSZip.
- Added deterministic markdown filename generation.
- Added manifest generation with success/failure items and diagnostics.
- Added overlay progress states for started, per-task, finished, and error phases.

### Phase 5: Validation on Representative Docs Sites

- Test single-level nav site
- Test multi-level collapsible nav site
- Test full-page navigation site
- Test SPA docs site
- Record failures, heuristics gaps, and follow-up tasks

### Phase 6: Shift Box Selection Shortcut

- Add `Shift + mouse drag` box selection in selection mode
- Hide the nav2md panel only after the drag passes the threshold
- Add intersecting docs nav links without clearing or toggling existing selections
- Keep click selection and export flow unchanged
- Verify with TypeScript and build checks

Progress notes:

- Added the box selection state machine to the content script.
- Added the box selection overlay styles.
- Verified with `npm run typecheck` and `npm run build`.

## Risks

- Navigation candidate detection may be noisy on custom layouts.
- Docs-container heuristics may need site-specific tuning.
- Async rendering may require better readiness checks.
- Sequential exports may feel slow for long task lists.
- Box selection may need real-site tuning for unusual navigation layouts.

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `new-project` created as file instead of directory | 1 | Removed the file, created the directory, then initialized git normally |
