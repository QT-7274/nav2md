# nav2md Shift Box Selection Design

## Goal

Add box selection to the in-page shortcut panel. While selection mode is active, the user can hold `Shift`, drag across the page, and add every matching docs navigation link touched by the rectangle.

## Confirmed Interaction

- `Shift + mouse drag` starts box selection.
- A small movement below the drag threshold does not start box selection.
- Once the drag passes the threshold, nav2md hides the panel, hides the hover box, and shows a selection rectangle.
- Releasing the mouse adds links inside the rectangle to the current selection.
- Box selection only adds links. It does not clear earlier selections or toggle selected links off.

## Non-Goals

- Do not change export behavior.
- Do not change background runtime messages.
- Do not add a public API.
- Do not replace click-to-select.

## State Model

The content script owns a small box selection state machine:

- `idle`: no box selection is in progress.
- `pending`: the user pressed the left mouse button while holding `Shift`; the script records the start point.
- `dragging`: pointer movement passed the `6px` threshold; the script hides the panel and renders the rectangle.
- `complete` or `cancel`: the script hides the rectangle, restores the panel, and returns to `idle`.

`Escape`, window blur, or leaving selection mode cancels a pending or active box selection.

Pointer capture keeps pointer events routed to the content script during an active drag. A `dragstart` guard blocks the browser's native anchor drag behavior while box selection is pending or dragging.

## Panel Visibility

The panel stays visible during `pending`. This prevents flicker when the user presses `Shift` and clicks by mistake.

The panel hides only after the pointer moves more than `6px`. It returns when the user releases the mouse or cancels the drag.

## Link Hit Testing

On mouse release, the content script checks visible `a[href]` elements. It reuses the existing docs navigation filter and selects a link when its bounding rectangle intersects the box selection rectangle.

The rectangle does not need to fully contain a link. Any intersection counts.

## Failure and Cancel Cases

- `Escape` cancels the box selection and keeps selection mode open.
- Window blur cancels the box selection and restores the panel.
- Mouse release completes the selection even when no links match.
- Leaving selection mode resets box selection state and hides the rectangle.

## Testing

Run:

```sh
npm run typecheck
npm run build
```

Manual checks:

- Normal click selection still works.
- `Shift + drag` shows the rectangle after the threshold.
- The panel hides only while the rectangle is active.
- Mouse release appends intersecting nav links.
- Existing selected links remain selected.
- `Escape` and window blur restore the panel.
