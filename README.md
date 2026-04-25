# nav2md

MVP Chrome extension for selecting docs navigation items in-page and exporting them to Markdown.

## Current Status

The repository currently contains a minimal loadable Chrome extension skeleton:

- `manifest.json`
- `src/background/service-worker.js`
- `src/content/index.js`
- `src/content/overlay.css`

## Load In Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select this repository root
5. Open a docs site and click the extension action

The current milestone only toggles selection mode and highlights candidate links.
