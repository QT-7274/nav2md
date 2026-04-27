# nav2md

MVP Chrome extension for selecting docs navigation items in-page and exporting them to Markdown.

## Current Status

The repository currently contains a TypeScript/Vite Chrome extension MVP slice:

- in-page selection mode for docs navigation links
- multi-select and deselect
- background export job orchestration
- sequential capture tab processing
- docs-content extraction
- Markdown conversion
- zip download with flat `.md` files and `manifest.json`

## Load In Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the generated `dist` directory
5. Open a docs site and click the extension action

Run `npm run build` before loading the extension. The build copies `manifest.json`
and `overlay.css` into `dist` and bundles the TypeScript runtime entries.

## Validate

```sh
npm run build
npm run lint
npm run typecheck
```
