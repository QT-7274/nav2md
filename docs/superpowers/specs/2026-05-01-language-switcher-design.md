# nav2md Language Switcher Design

## Goal

Add a small language switcher to the in-page nav2md panel. The switcher lets users choose Chinese or English, saves the choice, and applies it every time the panel opens.

## Scope

- Default language is Chinese.
- Supported languages are `zh-CN` and `en-US`.
- The panel stores the selected language in `chrome.storage.local` under `nav2md.locale`.
- The switcher appears in the panel header as a compact segmented tab: `中文` and `EN`.
- The selected language updates all static panel text without reloading the page.
- Dynamic content, including selected link titles, URLs, and runtime error messages from Chrome or the exporter, stays unchanged.

## Architecture

The content script owns the panel UI, so it also owns the language state. Add a small translation table in `src/content/index.ts` and read all panel labels through a helper that returns the current locale string.

Panel creation should keep references to nodes whose text changes: status, count label, empty state, export button, exit button, progress, and language tab buttons. A render function updates these nodes after the locale changes, after selections change, and after export progress changes.

## Persistence

On first panel creation, load `nav2md.locale` from `chrome.storage.local`. If the stored value is missing or invalid, use `zh-CN`. When the user clicks a language tab, update the in-memory locale, persist it, and re-render the panel.

## EdgeOne Geo Hook

Keep the initial locale logic behind a function such as `resolveInitialLocale()`. For now it returns stored locale or `zh-CN`. Later, EdgeOne geo detection can fill the fallback branch when no stored preference exists.

## UI Behavior

The language tabs use `aria-pressed` and a selected visual state. The control stays small enough for the current 250px panel. The panel title remains `nav2md` in both languages.

Chinese copy:

- Status: `选择模式已开启`
- Count label: `已选`
- Empty state: `还没有选择项目。`
- Export button: `开始导出`
- Export running: `导出中...`
- Exit button: `退出`

English copy keeps the current wording where possible:

- Status: `Selection mode active`
- Count label: `Selected`
- Empty state: `No items selected yet.`
- Export button: `Start export`
- Export running: `Exporting...`
- Exit button: `Exit`

## Export Progress Copy

Translate fixed status text in the content script:

- Starting export
- Export running
- Capturing
- Captured
- Failed
- Export error
- Export finished
- Export could not start
- Unknown error

Progress counts should also use localized wording for the final summary, such as `2 个已导出，1 个失败` in Chinese and `2 exported, 1 failed` in English.

## Testing

Run:

```sh
npm run typecheck
npm run build
```

Manual checks:

- First open shows Chinese.
- Switching to `EN` updates visible panel text.
- Reopening the panel keeps `EN`.
- Switching back to Chinese persists.
- Export disabled/running/finished text follows the selected language.
