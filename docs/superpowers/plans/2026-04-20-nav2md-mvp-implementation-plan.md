# nav2md MVP Implementation Plan

Date: 2026-04-20
Source Spec: `docs/superpowers/specs/2026-04-20-docs-nav-md-export-design.md`
Status: Ready for execution

## Objective

Implement the first working MVP of `nav2md` as a Chrome extension that:

- enters an in-page docs navigation selection mode
- lets the user select multiple left-nav targets
- sequentially visits selected pages
- extracts docs main content
- converts results to Markdown
- downloads one zip with flat markdown files and `manifest.json`

## Delivery Strategy

Build the MVP in thin vertical slices. The first milestone is not “all features done”; it is “one selected docs page can be exported end to end.” After that, expand to multi-select, queueing, and zip packaging.

## Recommended Stack

- TypeScript
- Vite with a Chrome extension build flow
- Chrome Manifest V3
- Content script for in-page selection
- Service worker for background orchestration
- Shared task and result types
- Turndown for HTML to Markdown
- JSZip for zip generation

## Directory Plan

Suggested initial structure:

```text
src/
  background/
    service-worker.ts
    export-queue.ts
  content/
    index.ts
    selection-controller.ts
    candidate-detector.ts
    overlay-ui.ts
  extractor/
    page-extractor.ts
    content-cleanup.ts
    selector-heuristics.ts
  export/
    markdown.ts
    filenames.ts
    manifest.ts
    zip.ts
  shared/
    messages.ts
    types.ts
    constants.ts
manifest.config.ts or manifest.json
```

Exact file names can vary, but responsibilities should stay separated.

## Milestones

### Milestone 1: Extension Boot and Page Injection

Goal:
Load an installable development extension that can toggle an in-page mode on the active tab.

Tasks:

- Set up package.json and build scripts
- Add Manifest V3 configuration
- Add extension action
- Register service worker
- Register content script entry
- Verify extension loads in Chrome developer mode
- Verify clicking the action toggles the content script overlay

Exit criteria:

- Extension builds successfully
- Extension loads in Chrome
- Clicking the action visibly toggles selection mode

### Milestone 2: Candidate Detection and Basic Selection

Goal:
Detect likely docs-left-nav targets and allow click-to-select and deselect.

Tasks:

- Build a candidate detector focused on left-column nav-like structures
- Normalize actual clickable targets to links or link-containing wrappers
- Add hover highlight box
- Add click interception when selection mode is active
- Store selected items in order
- Support deselection on repeat click
- Render a small overlay panel with count and exit control

Exit criteria:

- Hovering shows stable candidate highlighting
- Clicking selects visible docs nav items
- Multiple items can be selected
- Repeat click toggles selection off

### Milestone 3: Task Normalization and Single-Page Export

Goal:
Turn one selected item into one completed markdown export.

Tasks:

- Define shared task types for selected item metadata
- Convert selected DOM targets into export tasks
- Send tasks from content script to service worker
- Build a background flow that opens one target URL
- Wait for page readiness
- Run extractor on the target page
- Convert extracted HTML to Markdown
- Download a single markdown file for the first passing vertical slice

Exit criteria:

- One selected nav item can be exported end to end as markdown
- Failures produce actionable logs

### Milestone 4: Sequential Queue and Reusable Capture Tab

Goal:
Process multiple selected items in order.

Tasks:

- Add queue manager in background
- Reuse one capture tab where possible
- Add task progress tracking
- Prevent concurrent export jobs in the MVP
- Ensure failed tasks do not abort the full queue
- Return structured results for all tasks

Exit criteria:

- Multiple selected pages export sequentially
- Progress state is internally consistent
- One failed page does not stop the rest

### Milestone 5: Docs Extraction Heuristics

Goal:
Make extraction reliable enough across a small set of representative docs sites.

Tasks:

- Implement ordered main-content selector heuristics
- Prefer `main`, `article`, and `[role="main"]`
- Add cleanup rules for top nav, sidebars, breadcrumbs, footer, and floating widgets
- Preserve headings, lists, tables, links, and code blocks
- Add readiness wait logic for async-rendered docs pages
- Add diagnostic metadata when extraction fails

Exit criteria:

- Representative docs pages extract usable content
- Site chrome is mostly excluded
- Code blocks and tables survive in acceptable form

### Milestone 6: Zip Packaging and Manifest

Goal:
Produce the intended final artifact.

Tasks:

- Generate readable and deterministic filenames
- Deduplicate collisions safely
- Build result aggregation structure
- Generate `manifest.json`
- Package markdown files and manifest into zip
- Trigger final zip download

Exit criteria:

- A full export job downloads one zip
- Zip contains all successful markdown files plus `manifest.json`
- Failures are recorded in the manifest

### Milestone 7: User-Facing Progress and MVP Polish

Goal:
Surface enough runtime state for users to understand what is happening.

Tasks:

- Extend overlay panel with:
  - selected count
  - start export
  - running state
  - current progress
  - final success and failure counts
- Add cancel or close behavior rules for in-progress jobs
- Add basic empty and error states
- Ensure the selection overlay and progress panel do not block the docs UI more than necessary

Exit criteria:

- User can understand whether export is idle, running, or finished
- Final state is visible without opening DevTools

### Milestone 8: MVP Validation Pass

Goal:
Confirm the MVP works on a small but meaningful target set.

Tasks:

- Test on one single-level docs nav site
- Test on one multi-level collapsible docs nav site
- Test on one full-page navigation docs site
- Test on one SPA docs site
- Record issues and classify them as:
  - blocker
  - MVP follow-up
  - post-MVP enhancement

Exit criteria:

- Core end-to-end flow works on representative sites
- Known gaps are written down clearly

## Execution Order

The implementation should follow this order:

1. Milestone 1
2. Milestone 2
3. Milestone 3
4. Milestone 4
5. Milestone 5
6. Milestone 6
7. Milestone 7
8. Milestone 8

Do not start with zip packaging or advanced heuristics before the single-page export slice works.

## Shared Contracts to Define Early

Define these early to prevent rewrites:

- message protocol between content script and service worker
- `SelectedNavItem` type
- `ExportTask` type
- `ExtractionResult` type
- `ExportResultItem` type
- `ManifestItem` type

These can start minimal, but they should exist before Milestone 3 grows.

## First Implementation Slice

The first coding slice should be:

1. Create extension scaffold
2. Toggle selection mode
3. Select one nav item
4. Convert selection to one export task
5. Open target page
6. Extract one content container
7. Convert to markdown
8. Download one `.md`

If this passes, the rest of the MVP becomes a controlled expansion instead of a risky big-bang build.

## Testing Plan

### Manual

- load unpacked extension
- enter selection mode on a docs site
- select one item and export
- select several items and export
- verify markdown readability
- verify zip and manifest contents

### Structural checks

- link resolution correctness
- filename collision handling
- failure isolation
- async page readiness

### Regression checks

- selection mode off should not interfere with page interaction
- selection mode on should not accidentally capture extension UI itself
- exports should not duplicate the site sidebar in markdown

## Known Implementation Risks

- Chrome extension build tooling can add startup friction early
- docs selectors may need tuning per framework family
- some docs sites may lazy-render content after route change
- long sequential queues may need better user feedback than the MVP initially provides

## Post-Plan Handoff

Once execution begins:

- update `task_plan.md` phase status after each milestone
- write heuristic discoveries to `findings.md`
- log progress and validation results in `progress.md`

This plan is intentionally narrow and execution-oriented. If the implementation reveals a structural blocker, update the plan rather than silently expanding scope.
