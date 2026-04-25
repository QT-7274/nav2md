# Docs Navigation Markdown Exporter Design

Date: 2026-04-20
Status: Approved for planning

## Summary

This project is a Chrome extension for docs sites. Its MVP lets the user enter a page-level selection mode, click items in the left navigation like `slicer`, then export the selected documentation pages as Markdown files in a single zip archive.

The MVP is intentionally narrow:

- Chrome only
- Manual selection only
- Sequential page capture only
- Docs-layout-specific content extraction only
- Flat markdown files plus `manifest.json` in the zip

The MVP does not attempt full-site automatic discovery, full framework coverage, image localization, or folder hierarchy reconstruction.

## Goals

- Provide a `slicer`-style in-page selection experience for docs navigation items
- Let the user manually choose multiple left-nav links from the current docs site
- Visit each selected target page in order
- Extract the document main content area
- Convert the extracted content to Markdown
- Download one zip containing all exported markdown files and a `manifest.json`

## Non-Goals

- Automatic full-site crawling and one-click export of all pages
- Firefox, Safari, or Edge support in the MVP
- Generic article extraction as the primary path
- Downloading and rewriting image assets to local files
- Reconstructing folder hierarchy in the zip
- Strong support promises for authenticated or highly custom sites

## Product Shape

The product is a Chrome extension with in-page interaction.

User flow:

1. Open a docs site.
2. Click the extension action to enter selection mode.
3. Hover and click left navigation items to select export targets.
4. Review selection count in a lightweight overlay panel.
5. Click `Start Export`.
6. The extension visits each selected page, extracts content, converts it to Markdown, and packages the results.
7. The browser downloads a zip archive containing flat markdown files and a `manifest.json`.

## MVP Scope Decisions

The confirmed MVP choices are:

- Interaction model: page-level `slicer`-style selection
- Capture model: selected nav links are opened and processed one by one
- Extraction model: docs-container-specific extraction, not Readability-first
- Export structure: flat markdown files plus `manifest.json`

## Architecture

The system is split into four modules.

### 1. Content Script

Responsibilities:

- Enter and exit selection mode
- Detect likely left-nav candidates
- Handle hover, click, toggle, and multi-select state
- Render in-page overlay UI
- Convert selected DOM targets into normalized export tasks

This module does not do markdown conversion or zip creation.

### 2. Background / Service Worker

Responsibilities:

- Receive the selected task list
- Manage export job lifecycle
- Open or reuse a capture tab
- Visit target URLs sequentially
- Coordinate extraction results
- Aggregate export outputs
- Trigger the final zip download

This module owns progress tracking and job resilience.

### 3. Page Extractor

Responsibilities:

- Run on each target documentation page
- Locate the main docs content container
- Remove obvious non-content UI
- Return cleaned HTML or a normalized intermediate representation

This module is docs-oriented and layout-aware. It is not intended to be a universal article parser in the MVP.

### 4. Export Pipeline

Responsibilities:

- Convert extracted HTML into Markdown
- Normalize and deduplicate filenames
- Build the `manifest.json`
- Generate the zip archive
- Hand off the final blob for download

## Selection UX

The extension should feel close to `slicer`, but scoped to docs navigation.

Selection mode behavior:

- Hovering a left-nav candidate highlights it
- Clicking selects the item
- Clicking again toggles it off
- Continuous multi-select is supported
- A small overlay panel shows selected count and action controls
- The panel includes at least:
  - current selected count
  - most recent selected label
  - `Start Export`
  - `Exit Selection Mode`

MVP simplifications:

- No marquee selection
- No advanced keyboard hierarchy navigation requirement
- No full tree reconstruction in the selection UI

## Navigation Detection Strategy

The MVP uses candidate filtering plus manual confirmation, not full automatic tree understanding.

Detection rules:

- Prefer elements inside a visually left-side narrow column
- Prefer `nav`, `aside`, and list-based link containers
- Prefer nodes with real `href` links
- Allow a clickable wrapper if the actual link is nested inside
- Ignore clear non-docs UI such as top navigation, footer links, ads, or unrelated button groups

For each selected item, record:

- visible title text
- resolved URL
- selection order
- source DOM metadata
- optional inferred text path for later manifest use

This keeps the MVP robust across multiple docs frameworks without pretending to fully understand every nav tree structure.

## Export Task Model

Each selected item becomes one export task with fields like:

```json
{
  "id": "task_001",
  "title": "Getting Started",
  "url": "https://example.dev/docs/getting-started",
  "order": 1,
  "sourceTextPath": ["Guide", "Basics", "Getting Started"],
  "selectionMeta": {
    "tagName": "A",
    "text": "Getting Started"
  }
}
```

Exact field names may change during implementation, but the contract must preserve title, URL, order, and enough metadata to describe where the selection came from.

## Capture Flow

After the user starts export, the background worker runs a sequential job.

Per-task flow:

1. Open or reuse a capture tab for the target URL.
2. Wait for page load completion.
3. Wait for a short stabilization window for async docs rendering.
4. Run the page extractor on the target page.
5. Convert the extracted content to Markdown.
6. Store success or failure in the aggregated export result.

The job continues even if individual pages fail.

## Content Extraction Rules

The extractor is docs-specific and uses ordered fallbacks.

Preferred content targets:

- `main`
- `article`
- `[role="main"]`
- known docs content selectors
- largest likely text-heavy content container as last fallback

The extractor should strip obvious non-content UI:

- top navigation
- sidebars
- footer blocks
- breadcrumbs
- edit-page buttons
- floating feedback widgets
- unrelated overlays

The extractor should preserve:

- headings
- paragraphs
- ordered and unordered lists
- blockquotes
- tables
- code blocks
- inline code
- links

## Markdown Conversion

The Markdown pipeline should prioritize readability and structural fidelity.

Requirements:

- preserve heading hierarchy
- preserve fenced code blocks where possible
- preserve tables where possible
- keep links intact
- avoid duplicating site chrome

The MVP may reuse ideas or libraries from `markdownload`, but the extraction entry point remains docs-container-first.

## Zip Output Structure

The zip archive contains:

- one flat markdown file per successful export target
- a `manifest.json`

Filename rules:

- sanitize illegal filesystem characters
- deduplicate collisions deterministically
- prefer readable names based on document title

Example:

```text
docs-export.zip
  getting-started.md
  installation.md
  routing-basics.md
  manifest.json
```

## Manifest Contract

`manifest.json` records export metadata and outcomes. It should include:

- export timestamp
- source site origin
- total task count
- success count
- failure count
- per-item:
  - title
  - original URL
  - selection order
  - source text path
  - output filename if successful
  - status
  - error message if failed

Example shape:

```json
{
  "generatedAt": "2026-04-20T12:00:00.000Z",
  "origin": "https://example.dev",
  "total": 3,
  "success": 2,
  "failed": 1,
  "items": [
    {
      "title": "Getting Started",
      "url": "https://example.dev/docs/getting-started",
      "order": 1,
      "sourceTextPath": ["Guide", "Basics", "Getting Started"],
      "filename": "getting-started.md",
      "status": "success"
    },
    {
      "title": "Advanced Routing",
      "url": "https://example.dev/docs/routing",
      "order": 2,
      "sourceTextPath": ["Guide", "Advanced", "Routing"],
      "status": "failed",
      "error": "Main content container not found"
    }
  ]
}
```

## Error Handling

Failure of one page must not abort the whole export.

Rules:

- mark failed pages in the manifest
- continue remaining tasks
- expose running progress in the overlay or related status UI
- show final success and failure counts

Expected failure classes:

- target page did not load
- no valid main content container found
- extraction returned empty content
- markdown conversion failed
- zip generation failed

Only zip generation failure should block final download completely.

## Testing Strategy

MVP validation should focus on end-to-end correctness across a small but representative set of docs sites.

Required coverage:

- single-level left navigation site
- multi-level collapsible navigation site
- full-page navigation site
- SPA route-switching docs site
- pages containing code blocks, tables, and callout-like content

Minimum acceptance criteria:

- selection mode activates reliably
- left-nav candidates can be selected and toggled
- multiple selected items are preserved in order
- selected URLs are visited sequentially
- content extraction succeeds on representative sites
- markdown files are generated and zipped
- `manifest.json` is included and accurate enough to debug failures

## Risks

Primary MVP risks:

- navigation candidate detection is noisy on highly customized docs layouts
- docs main-content container heuristics may fail across frameworks
- asynchronous page rendering may require more robust readiness checks
- sequential tab navigation may feel slow on large selections

The MVP accepts these risks in exchange for faster validation.

## Evolution Path

### Phase 1: MVP

- in-page manual nav selection
- sequential export
- docs-container-first extraction
- flat zip output plus manifest

### Phase 2: MVP+

- cached site-specific rules
- grouped multi-select helpers
- retry failed pages
- smarter navigation detection
- better readiness heuristics

### Phase 3: V2

- partial or full auto-scan of docs trees
- semi-automatic site export
- richer framework adapters
- folder hierarchy restoration
- image asset handling

## Open Decisions Resolved

The following decisions were made during brainstorming and are intentionally fixed for the MVP:

- The product is a Chrome extension, not a bookmarklet
- The interaction model is `slicer`-style in-page selection
- The user manually selects targets
- The export job opens selected pages one by one
- Extraction is docs-layout-specific
- Output files are flat, with hierarchy preserved only in `manifest.json`

## Implementation Readiness

This design is scoped tightly enough for a single implementation plan. The system boundaries are clear, the MVP is narrow, and no section depends on undefined placeholder behavior.
