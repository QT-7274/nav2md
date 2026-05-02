<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="nav2md icon">
</p>

# nav2md

> Select documentation navigation links in Chrome and export the linked pages as Markdown.
>
> 在 Chrome 中选择文档站点的导航链接，并将对应页面导出为 Markdown。

[中文](#中文) | [English](#english)

## 中文

nav2md 是一个 Chrome 扩展，用来把文档站点的侧边栏导航批量转换成 Markdown。打开文档页面后，点击扩展图标进入选择模式，选择要导出的导航项，nav2md 会逐页抓取正文内容，并下载一个 zip 文件。

### 功能

- 在页面内选择文档导航链接
- 支持单击选择、取消选择和 `Shift` 拖拽框选
- 支持一键全选可识别的导航链接
- 支持中文和英文面板
- 将页面正文转换为 Markdown
- 导出 zip，包含逐页 `.md` 文件、`index.md` 和 `manifest.json`

### 使用

1. 在 Chrome 中打开一个文档站点。
2. 点击 nav2md 扩展图标，进入选择模式。
3. 单击导航链接选择页面，或按住 `Shift` 拖拽框选多个链接。
4. 点击 `开始导出`。
5. 在下载确认框中保存生成的 zip 文件。

快捷键：

| 操作 | 快捷键 |
| --- | --- |
| 选择或取消选择链接 | 左键点击 |
| 框选链接 | `Shift` + 拖拽 |
| 关闭 nav2md | `Esc` |

### 本地安装

```sh
npm install
npm run build
```

然后在 Chrome 中加载扩展：

1. 打开 `chrome://extensions`
2. 开启 `Developer mode`
3. 点击 `Load unpacked`
4. 选择生成的 `dist` 目录
5. 打开文档站点并点击扩展图标

### 发布构建

```sh
npm run build
npm run typecheck
npm run lint
```

`npm run build` 会生成 `dist`，并复制 `manifest.json`、icons、content CSS 和 offscreen download helper。发布到 Chrome Web Store 时，上传 `dist` 目录打包后的 zip。

### 输出内容

导出的 zip 包含：

- 每个成功抓取页面的 Markdown 文件
- `index.md`：导出索引和成功/失败摘要
- `manifest.json`：任务顺序、来源 URL、生成文件名、错误信息和诊断信息

### 要求

- Chrome 109+
- Node.js `^20.19.0` 或 `>=22.12.0`

## English

nav2md is a Chrome extension for turning documentation sidebars into Markdown exports. Open a docs page, click the extension icon, select the navigation items you want, and nav2md captures each linked page into a downloadable zip file.

### Features

- Select docs navigation links directly on the page
- Click to select or deselect links
- Hold `Shift` and drag to box-select links
- Select all detected navigation links
- Switch the panel between Chinese and English
- Convert page content to Markdown
- Export a zip with per-page `.md` files, `index.md`, and `manifest.json`

### Usage

1. Open a documentation site in Chrome.
2. Click the nav2md extension icon to enter selection mode.
3. Click navigation links, or hold `Shift` and drag to select multiple links.
4. Click `Start export`.
5. Save the generated zip file.

Shortcuts:

| Action | Shortcut |
| --- | --- |
| Select or deselect a link | Left click |
| Box-select links | `Shift` + drag |
| Close nav2md | `Esc` |

### Local Install

```sh
npm install
npm run build
```

Then load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the generated `dist` directory
5. Open a docs site and click the extension icon

### Release Build

```sh
npm run build
npm run typecheck
npm run lint
```

`npm run build` creates `dist` and copies `manifest.json`, icons, content CSS, and the offscreen download helper. For Chrome Web Store publication, upload a zip made from the `dist` directory.

### Export Format

The exported zip contains:

- One Markdown file for each successfully captured page
- `index.md` with the export index and success/failure summary
- `manifest.json` with task order, source URLs, filenames, errors, and diagnostics

### Requirements

- Chrome 109+
- Node.js `^20.19.0` or `>=22.12.0`
