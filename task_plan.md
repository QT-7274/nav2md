# nav2md Task Plan

## Goal

Build the MVP of `nav2md`: a Chrome extension that lets the user select left-side docs navigation items in-page, then sequentially export the selected docs pages as Markdown files inside a zip archive with a `manifest.json`.

## Current Status

- Phase 1: Repository bootstrap and project skeleton — pending
- Phase 2: Extension selection-mode foundation — pending
- Phase 3: Export job orchestration and extraction pipeline — pending
- Phase 4: Zip export, manifest, and progress UI — pending
- Phase 5: Validation on representative docs sites — pending

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

### Phase 2: Extension Selection-Mode Foundation

- Implement service worker action toggle
- Inject content script into docs pages
- Build left-nav candidate detection
- Add hover, select, deselect, and selected-item state
- Add minimal in-page overlay controls

### Phase 3: Export Job Orchestration and Extraction Pipeline

- Normalize selected items into export tasks
- Build sequential capture job in background
- Open and reuse capture tab
- Wait for page readiness and run extractor
- Extract docs main content container and clean UI noise
- Convert cleaned content to Markdown

### Phase 4: Zip Export, Manifest, and Progress UI

- Create deterministic filename generation
- Aggregate results and failures
- Generate `manifest.json`
- Package zip and trigger download
- Surface progress and final counts in UI

### Phase 5: Validation on Representative Docs Sites

- Test single-level nav site
- Test multi-level collapsible nav site
- Test full-page navigation site
- Test SPA docs site
- Record failures, heuristics gaps, and follow-up tasks

## Risks

- Navigation candidate detection may be noisy on custom layouts.
- Docs-container heuristics may need site-specific tuning.
- Async rendering may require better readiness checks.
- Sequential exports may feel slow for long task lists.

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| `new-project` created as file instead of directory | 1 | Removed the file, created the directory, then initialized git normally |
