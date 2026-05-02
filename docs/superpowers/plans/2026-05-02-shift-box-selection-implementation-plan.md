# Shift Box Selection Implementation Plan

Date: 2026-05-02
Source Spec: `docs/superpowers/specs/2026-05-02-shift-box-selection-design.md`
Status: Ready for execution

## Objective

Add `Shift + mouse drag` box selection to the nav2md content overlay without changing export behavior.

## Implementation Steps

1. Add box selection constants, state, and DOM references in `src/content/index.ts`.
2. Create a hidden `#nav2md-extension-box-select` node inside the existing root.
3. Add pointer handlers for `pointerdown`, `pointermove`, `pointerup`, and `pointercancel`.
4. Enter dragging only after the pointer moves more than `6px`.
5. Hide the panel and hover box while dragging.
6. On mouse release, add every intersecting likely docs nav link.
7. Cancel box selection on `Escape`, window blur, and selection mode close.
8. Add CSS for the rectangle and temporary text-selection suppression.
9. Update planning records.
10. Verify with `npm run typecheck` and `npm run build`.

## Acceptance Criteria

- Click selection still selects and deselects one link.
- `Shift + drag` past the threshold shows a rectangle.
- The panel disappears only while the rectangle is active.
- Mouse release appends matching links and restores the panel.
- Already selected links stay selected.
- `Escape` cancels box selection without closing selection mode.
- TypeScript and build checks pass.

## Notes

The implementation stays inside the content overlay. It does not change manifest permissions, background messages, extraction, zip generation, or public types.

Use pointer events with pointer capture for the drag lifecycle, and block native `dragstart` while box selection is pending or dragging.
