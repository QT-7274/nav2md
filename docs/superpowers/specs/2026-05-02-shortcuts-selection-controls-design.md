# nav2md Shortcuts And Selection Controls Design

## Goal

Make the in-page panel less noisy for repeat users and reserve space for two upcoming selection actions: reset selected items and select all nav tabs.

## Confirmed Decisions

- The shortcuts block is collapsed by default.
- The collapsed row shows a compact `快捷键` / `Shortcuts` entry with an expand affordance.
- Expanding the row reveals the existing shortcut list.
- Reset and select-all controls sit in the selected-count row, next to the current count.
- This design covers UI placement and copy. It does not implement reset or select-all behavior yet.

## Selection Controls

The selected-count row becomes the home for selection management:

```text
已选 3        重置  全选
Selected 3    Reset  All
```

`重置` is reserved for clearing the current selected items while keeping selection mode open. `全选` is reserved for selecting every matching nav tab in the detected nav area. Both controls should be compact text buttons, not full-width actions, because they manage the current selection rather than the export flow.

In the first UI-only pass, the controls can render as disabled reserved controls or inert controls with clear disabled styling. Their click handlers, enabled-state rules, and error cases belong to the later behavior pass.

## Shortcuts Panel

The shortcuts section becomes a disclosure:

- Collapsed by default on every panel open.
- Click the disclosure header to expand or collapse it.
- Preserve the current localized shortcut rows when expanded.
- Add rows for the upcoming reset and select-all actions only after their keyboard handling exists.

This avoids storing a "learned" state and keeps the first implementation simple. Users who need the reminder can open it, while experienced users see a smaller panel.

## Shortcut Recommendations

Use platform-aware labels for future keyboard support:

- Select all nav tabs: `⌘A` on macOS, `Ctrl+A` elsewhere.
- Reset selected items: prefer no mandatory shortcut in the first UI pass. If keyboard support is added later, use `⌘Backspace` on macOS and `Ctrl+Backspace` elsewhere.

Avoid `Ctrl+R` because browsers use it for page reload. Keep `Esc` for closing nav2md or cancelling an active box selection.

## Non-Goals

- Do not change export behavior.
- Do not implement reset behavior in this UI-only pass.
- Do not implement select-all behavior in this UI-only pass.
- Do not change docs nav detection.
- Do not add persistent shortcut-learning state.

## Testing

Run:

```sh
npm run typecheck
npm run build
```

Manual checks:

- Panel opens with shortcuts collapsed.
- Expanding shortcuts shows the existing shortcut rows.
- Collapsing shortcuts hides the rows again.
- Reset and select-all controls appear in the selected-count row.
- Reset and select-all controls use a visible reserved or disabled state until behavior ships.
- Existing export and exit buttons keep their current behavior.
- Chinese and English labels fit inside the 250px panel.
