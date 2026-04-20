# nav2md Findings

## Confirmed Product Direction

- MVP is a Chrome extension with in-page interaction.
- The interaction model should feel like `slicer`, but target docs left navigation items.
- The user manually selects nav targets in the MVP.
- Selected pages are opened and processed one by one.
- Extraction prefers docs main-content containers over generic article extraction.
- Zip output is flat markdown files plus `manifest.json`.

## Reference Project Findings

### `selector`

- Uses bookmarklet injection and page-level DOM overlays.
- Good reference for lightweight page selection mechanics.
- Poor fit as the main product shape because the MVP needs background orchestration and stronger export flow.

### `slicer-dev-chrome-tool`

- Best interaction reference for the MVP.
- Uses an extension action plus content script to enter selection mode.
- Handles hover, click interception, overlay rendering, and extension-managed lifecycle.
- Better fit than `selector` because it already uses extension architecture.

### `markdownload`

- Best export-pipeline reference for the MVP.
- Demonstrates extension permissions, markdown conversion flow, and download-oriented behavior.
- Does not solve docs-left-nav selection, but is useful for extraction and markdown pipeline ideas.

## Design Spec

- Approved design spec path:
  - `docs/superpowers/specs/2026-04-20-docs-nav-md-export-design.md`

## Repository Context

- Repository name: `nav2md`
- GitHub remote: `https://github.com/QT-7274/nav2md.git`

