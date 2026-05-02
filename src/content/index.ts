const ROOT_ID = "nav2md-extension-root";
const PANEL_ID = "nav2md-extension-panel";
const HOVER_ID = "nav2md-extension-hover";
const BOX_SELECT_ID = "nav2md-extension-box-select";
const LIST_ID = "nav2md-extension-selection-list";
const LOCALE_STORAGE_KEY = "nav2md.locale";

type Locale = "zh-CN" | "en-US";
type StatusKey =
  | "selectionModeActive"
  | "startingExport"
  | "exportRunning"
  | "capturing"
  | "captured"
  | "failed"
  | "exportError"
  | "exportFinished"
  | "exportCouldNotStart";

interface PanelStatus {
  running: boolean;
  key: StatusKey;
  detail?: string;
  progress?: PanelProgress;
}

type PanelProgress =
  | {
      kind: "plain";
      text: string;
    }
  | {
      kind: "summary";
      success: number;
      failed: number;
    };

type TextKey = {
  [K in keyof PanelCopy]: PanelCopy[K] extends string ? K : never;
}[keyof PanelCopy];

interface PanelCopy {
  language: string;
  selectionModeActive: string;
  selected: string;
  noItemsSelectedYet: string;
  startExport: string;
  exporting: string;
  exit: string;
  startingExport: string;
  exportRunning: string;
  capturing: (detail?: string) => string;
  captured: (detail?: string) => string;
  failed: (detail?: string) => string;
  exportError: string;
  exportFinished: string;
  exportCouldNotStart: string;
  unknownError: string;
  exportedSummary: (success: number, failed: number) => string;
  localeSwitcherLabel: string;
  shortcutsTitle: string;
  shortcutSelectLink: string;
  shortcutBoxSelectLinks: string;
  shortcutCloseNav2md: string;
  shortcutClick: string;
  shortcutShift: string;
  shortcutDrag: string;
  shortcutExit: string;
}

interface SelectedItem {
  text: string;
  href: string;
  element: HTMLAnchorElement;
}

interface Point {
  x: number;
  y: number;
}

interface BoxRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

type BoxSelectionPhase = "idle" | "pending" | "dragging";

interface BoxSelectionState {
  phase: BoxSelectionPhase;
  start: Point;
  current: Point;
  pointerId: number | null;
}

interface ExportProgressMessage {
  type: "NAV2MD_EXPORT_PROGRESS";
  phase: string;
  total?: number;
  completed?: number;
  success?: number;
  failed?: number;
  message?: string;
  reason?: string;
  task?: {
    title?: string;
  };
  result?: {
    ok?: boolean;
  };
  error?: {
    reason?: string;
    message?: string;
  };
}

let selectionEnabled = false;
let currentTarget: HTMLAnchorElement | null = null;
let rootNode: HTMLDivElement | null = null;
let panelNode: HTMLDivElement | null = null;
let hoverNode: HTMLDivElement | null = null;
let boxSelectNode: HTMLDivElement | null = null;
let countLabelNode: HTMLElement | null = null;
let countNode: HTMLElement | null = null;
let statusNode: HTMLElement | null = null;
let progressNode: HTMLElement | null = null;
let localeSwitchNode: HTMLElement | null = null;
let shortcutsNode: HTMLElement | null = null;
let selectedListNode: HTMLElement | null = null;
let exportButtonNode: HTMLButtonElement | null = null;
let exitButtonNode: HTMLButtonElement | null = null;
let localeButtonNodes: HTMLButtonElement[] = [];
let shortcutCopyNodes: HTMLElement[] = [];
const selectedItems = new Map<string, SelectedItem>();
let exportRunning = false;
let suppressNextClick = false;
let cachedNavContainer: Element | null = null;
let repositionFrameId: number | null = null;
let hoverFrameId: number | null = null;
let shouldRefreshNavContainer = false;
let currentLocale: Locale = "zh-CN";
let localeLoadPromise: Promise<void> | null = null;
let localePreferenceOverride: Locale | null = null;
let panelStatus: PanelStatus = {
  running: false,
  key: "selectionModeActive"
};
let boxSelectionState: BoxSelectionState = {
  phase: "idle",
  start: { x: 0, y: 0 },
  current: { x: 0, y: 0 },
  pointerId: null
};

const COPY: Record<Locale, PanelCopy> = {
  "zh-CN": {
    language: "中文",
    selectionModeActive: "选择模式已开启",
    selected: "已选",
    noItemsSelectedYet: "还没有选择项目。",
    startExport: "开始导出",
    exporting: "导出中...",
    exit: "退出",
    startingExport: "开始导出...",
    exportRunning: "导出运行中",
    capturing: (detail) => (detail ? `正在抓取：${detail}` : "正在抓取"),
    captured: (detail) => (detail ? `已抓取：${detail}` : "已抓取"),
    failed: (detail) => (detail ? `失败：${detail}` : "失败"),
    exportError: "导出错误",
    exportFinished: "导出完成",
    exportCouldNotStart: "无法开始导出。",
    unknownError: "未知错误",
    exportedSummary: (success, failed) => `${success} 个已导出，${failed} 个失败`,
    localeSwitcherLabel: "语言",
    shortcutsTitle: "快捷键",
    shortcutSelectLink: "选择链接",
    shortcutBoxSelectLinks: "框选链接",
    shortcutCloseNav2md: "关闭 nav2md",
    shortcutClick: "左键点击",
    shortcutShift: "Shift",
    shortcutDrag: "拖拽",
    shortcutExit: "Esc"
  },
  "en-US": {
    language: "EN",
    selectionModeActive: "Selection mode active",
    selected: "Selected",
    noItemsSelectedYet: "No items selected yet.",
    startExport: "Start export",
    exporting: "Exporting...",
    exit: "Exit",
    startingExport: "Starting export...",
    exportRunning: "Export running",
    capturing: (detail) => (detail ? `Capturing: ${detail}` : "Capturing"),
    captured: (detail) => (detail ? `Captured: ${detail}` : "Captured"),
    failed: (detail) => (detail ? `Failed: ${detail}` : "Failed"),
    exportError: "Export error",
    exportFinished: "Export finished",
    exportCouldNotStart: "Export could not start.",
    unknownError: "Unknown error",
    exportedSummary: (success, failed) => `${success} exported, ${failed} failed`,
    localeSwitcherLabel: "Language",
    shortcutsTitle: "Shortcuts",
    shortcutSelectLink: "Select link",
    shortcutBoxSelectLinks: "Box select links",
    shortcutCloseNav2md: "Close nav2md",
    shortcutClick: "Left click",
    shortcutShift: "Shift",
    shortcutDrag: "Drag",
    shortcutExit: "Esc"
  }
};

const PANEL_MARGIN_PX = 16;
const PANEL_GAP_PX = 12;
const BOX_SELECT_THRESHOLD_PX = 6;
const NAV_CONTAINER_SELECTOR =
  "aside, nav, [role='navigation'], [role='tree'], [class*='sidebar' i], [class*='sidenav' i], [class*='side-nav' i], [class*='docs-nav' i]";

function isWithinExtension(node: EventTarget | null) {
  return node instanceof Element && node.closest(`#${ROOT_ID}`);
}

function t(key: TextKey) {
  return COPY[currentLocale][key];
}

function isTextKey(value: string | undefined): value is TextKey {
  return Boolean(value) && typeof COPY[currentLocale][value as keyof PanelCopy] === "string";
}

function getLocaleButtonLabels() {
  return {
    "zh-CN": COPY["zh-CN"].language,
    "en-US": COPY["en-US"].language
  };
}

function resolveStatusText(status: PanelStatus) {
  const copy = COPY[currentLocale];

  switch (status.key) {
    case "selectionModeActive":
      return copy.selectionModeActive;
    case "startingExport":
      return copy.startingExport;
    case "exportRunning":
      return copy.exportRunning;
    case "capturing":
      return copy.capturing(status.detail);
    case "captured":
      return copy.captured(status.detail);
    case "failed":
      return copy.failed(status.detail);
    case "exportError":
      return copy.exportError;
    case "exportFinished":
      return copy.exportFinished;
    case "exportCouldNotStart":
      return copy.exportCouldNotStart;
    default:
      return copy.selectionModeActive;
  }
}

function resolveProgressText(progress?: PanelProgress) {
  if (!progress) return "";
  if (progress.kind === "summary") {
    return COPY[currentLocale].exportedSummary(progress.success, progress.failed);
  }
  return progress.text;
}

function setPanelStatus(status: PanelStatus) {
  panelStatus = status;
  exportRunning = status.running;
  updatePanel();
}

function normalizeLocale(value: unknown): Locale | null {
  return value === "zh-CN" || value === "en-US" ? value : null;
}

async function hydrateLocalePreference() {
  if (localeLoadPromise) return localeLoadPromise;

  localeLoadPromise = (async () => {
    try {
      const stored = await chrome.storage.local.get(LOCALE_STORAGE_KEY);
      const locale = normalizeLocale(stored[LOCALE_STORAGE_KEY]);
      if (!localePreferenceOverride && locale) {
        currentLocale = locale;
      }
    } catch (error) {
      console.debug("nav2md locale preference could not be loaded", error);
    } finally {
      updatePanel();
    }
  })();

  return localeLoadPromise;
}

async function setLocale(locale: Locale) {
  if (locale === currentLocale) {
    updatePanel();
    return;
  }

  currentLocale = locale;
  localePreferenceOverride = locale;
  updatePanel();

  try {
    await chrome.storage.local.set({ [LOCALE_STORAGE_KEY]: locale });
  } catch (error) {
    console.debug("nav2md locale preference could not be saved", error);
  }
}

function ensureRoot() {
  if (rootNode) return rootNode;

  rootNode = document.createElement("div");
  rootNode.id = ROOT_ID;
  document.documentElement.appendChild(rootNode);

  hoverNode = document.createElement("div");
  hoverNode.id = HOVER_ID;
  hoverNode.hidden = true;
  rootNode.appendChild(hoverNode);

  boxSelectNode = document.createElement("div");
  boxSelectNode.id = BOX_SELECT_ID;
  boxSelectNode.hidden = true;
  rootNode.appendChild(boxSelectNode);

  panelNode = document.createElement("div");
  panelNode.id = PANEL_ID;
  panelNode.innerHTML = `
    <div class="nav2md-panel__header">
      <div class="nav2md-panel__title">nav2md</div>
      <div class="nav2md-panel__locale-switch" role="group">
        <button class="nav2md-panel__locale-button" type="button" data-locale="zh-CN"></button>
        <button class="nav2md-panel__locale-button" type="button" data-locale="en-US"></button>
      </div>
    </div>
    <div class="nav2md-panel__status"></div>
    <div class="nav2md-panel__meta">
      <span class="nav2md-panel__count-label"></span>
      <span class="nav2md-panel__count-value">0</span>
    </div>
    <div class="nav2md-panel__progress" hidden></div>
    <div id="${LIST_ID}" class="nav2md-panel__list"></div>
    <button class="nav2md-panel__button nav2md-panel__button--secondary" type="button" data-action="export"></button>
    <button class="nav2md-panel__button" type="button" data-action="exit"></button>
    <div class="nav2md-panel__shortcuts">
      <div class="nav2md-panel__shortcuts-title" data-copy-key="shortcutsTitle"></div>
      <div class="nav2md-panel__shortcut-row">
        <span data-copy-key="shortcutSelectLink"></span>
        <span class="nav2md-panel__shortcut-keys">
          <kbd data-copy-key="shortcutClick"></kbd>
        </span>
      </div>
      <div class="nav2md-panel__shortcut-row">
        <span data-copy-key="shortcutBoxSelectLinks"></span>
        <span class="nav2md-panel__shortcut-keys">
          <kbd data-copy-key="shortcutShift"></kbd>
          <span>+</span>
          <kbd data-copy-key="shortcutDrag"></kbd>
        </span>
      </div>
      <div class="nav2md-panel__shortcut-row">
        <span data-copy-key="shortcutCloseNav2md"></span>
        <span class="nav2md-panel__shortcut-keys">
          <kbd data-copy-key="shortcutExit"></kbd>
        </span>
      </div>
    </div>
  `;
  rootNode.appendChild(panelNode);

  countLabelNode = panelNode.querySelector(".nav2md-panel__count-label");
  countNode = panelNode.querySelector(".nav2md-panel__count-value");
  statusNode = panelNode.querySelector(".nav2md-panel__status");
  progressNode = panelNode.querySelector(".nav2md-panel__progress");
  localeSwitchNode = panelNode.querySelector(".nav2md-panel__locale-switch");
  shortcutsNode = panelNode.querySelector(".nav2md-panel__shortcuts");
  selectedListNode = panelNode.querySelector(`#${LIST_ID}`);
  exportButtonNode = panelNode.querySelector<HTMLButtonElement>("[data-action='export']");
  exitButtonNode = panelNode.querySelector<HTMLButtonElement>("[data-action='exit']");
  localeButtonNodes = Array.from(panelNode.querySelectorAll<HTMLButtonElement>("[data-locale]"));
  shortcutCopyNodes = Array.from(panelNode.querySelectorAll<HTMLElement>("[data-copy-key]"));

  exitButtonNode?.addEventListener("click", () => setSelectionMode(false));
  exportButtonNode?.addEventListener("click", () => {
    sendExportTasks().catch((error) => {
      console.error("Failed to send export tasks", error);
    });
  });

  localeButtonNodes.forEach((button) => {
    button.addEventListener("click", () => {
      const locale = normalizeLocale(button.dataset.locale);
      if (locale) {
        void setLocale(locale);
      }
    });
  });

  updatePanel();

  return rootNode;
}

function toExportTask(item: SelectedItem, index: number) {
  return {
    id: `task_${String(index + 1).padStart(3, "0")}`,
    title: item.text,
    url: item.href,
    order: index + 1,
    sourceTextPath: [item.text],
    selectionMeta: {
      tagName: item.element.tagName,
      text: item.text
    }
  };
}

async function sendExportTasks() {
  if (selectedItems.size === 0 || exportRunning) return;

  const tasks = Array.from(selectedItems.values()).map(toExportTask);
  setPanelStatus({
    running: true,
    key: "startingExport",
    progress: {
      kind: "plain",
      text: `0 / ${tasks.length}`
    }
  });

  const response = await chrome.runtime.sendMessage({
    type: "NAV2MD_EXPORT_SELECTIONS",
    tasks
  });

  if (!response?.ok) {
    setPanelStatus({
      running: false,
      key: "exportCouldNotStart",
      progress: {
        kind: "plain",
        text: response?.reason || t("unknownError")
      }
    });
  }
}

function updatePanel() {
  repositionPanel();

  if (countLabelNode) countLabelNode.textContent = t("selected");
  if (countNode) countNode.textContent = String(selectedItems.size);
  if (statusNode) statusNode.textContent = resolveStatusText(panelStatus);
  if (shortcutsNode) shortcutsNode.setAttribute("aria-label", t("shortcutsTitle"));
  if (localeSwitchNode) {
    localeSwitchNode.setAttribute("aria-label", t("localeSwitcherLabel"));
  }
  if (progressNode) {
    progressNode.hidden = !panelStatus.progress;
    progressNode.textContent = resolveProgressText(panelStatus.progress);
  }
  if (exportButtonNode) {
    exportButtonNode.disabled = selectedItems.size === 0 || panelStatus.running;
    exportButtonNode.textContent = panelStatus.running ? t("exporting") : t("startExport");
  }
  if (exitButtonNode) {
    exitButtonNode.textContent = t("exit");
  }
  const localeLabels = getLocaleButtonLabels();
  localeButtonNodes.forEach((button) => {
    const locale = normalizeLocale(button.dataset.locale) || "zh-CN";
    button.textContent = localeLabels[locale];
    button.setAttribute("aria-pressed", String(locale === currentLocale));
    button.classList.toggle("nav2md-panel__locale-button--active", locale === currentLocale);
  });
  shortcutCopyNodes.forEach((node) => {
    const copyKey = node.dataset.copyKey;
    if (isTextKey(copyKey)) node.textContent = t(copyKey);
  });
  const listNode = selectedListNode;
  if (!listNode) return;

  listNode.replaceChildren();

  if (selectedItems.size === 0) {
    const emptyNode = document.createElement("div");
    emptyNode.className = "nav2md-panel__empty";
    emptyNode.textContent = t("noItemsSelectedYet");
    listNode.appendChild(emptyNode);
    return;
  }

  Array.from(selectedItems.values()).forEach((item) => {
    const itemNode = document.createElement("div");
    itemNode.className = "nav2md-panel__item";
    itemNode.title = item.href;

    const titleNode = document.createElement("div");
    titleNode.className = "nav2md-panel__item-title";
    titleNode.textContent = item.text;

    const urlNode = document.createElement("div");
    urlNode.className = "nav2md-panel__item-url";
    urlNode.textContent = item.href;

    itemNode.append(titleNode, urlNode);
    listNode.appendChild(itemNode);
  });
}

function isVisibleNavContainer(element: Element) {
  if (isWithinExtension(element)) return false;

  const rect = element.getBoundingClientRect();
  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

  if (rect.width < 120 || rect.height < 160) return false;
  if (rect.bottom <= 0 || rect.top >= viewportHeight) return false;
  if (rect.right <= 0 || rect.left >= viewportWidth) return false;
  if (rect.left > viewportWidth * 0.45) return false;

  return true;
}

function scoreNavContainer(element: Element) {
  const rect = element.getBoundingClientRect();
  const tagScore = element.tagName.toLowerCase() === "aside" ? 200 : 0;
  const roleScore = element.getAttribute("role") === "navigation" ? 80 : 0;
  const heightScore = Math.min(rect.height, 900) / 6;
  const leftPenalty = Math.max(rect.left, 0) / 2;

  return tagScore + roleScore + heightScore - leftPenalty;
}

function findBestNavContainer(refresh = false) {
  if (!refresh && cachedNavContainer?.isConnected && isVisibleNavContainer(cachedNavContainer)) {
    return cachedNavContainer;
  }

  let bestContainer: Element | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  document.querySelectorAll(NAV_CONTAINER_SELECTOR).forEach((candidate) => {
    if (!isVisibleNavContainer(candidate)) return;

    const score = scoreNavContainer(candidate);
    if (score > bestScore) {
      bestContainer = candidate;
      bestScore = score;
    }
  });

  cachedNavContainer = bestContainer;
  return bestContainer;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function repositionPanel(refreshNavContainer = false) {
  if (!selectionEnabled || !panelNode) return;

  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const panelWidth = panelNode.offsetWidth || 220;
  const panelHeight = panelNode.offsetHeight || 240;
  const maxLeft = Math.max(PANEL_MARGIN_PX, viewportWidth - panelWidth - PANEL_MARGIN_PX);
  const maxTop = Math.max(PANEL_MARGIN_PX, viewportHeight - panelHeight - PANEL_MARGIN_PX);
  const fallbackLeft = maxLeft;
  const fallbackTop = PANEL_MARGIN_PX;
  const navContainer = findBestNavContainer(refreshNavContainer);

  let left = fallbackLeft;
  let top = fallbackTop;

  if (navContainer) {
    const rect = navContainer.getBoundingClientRect();
    const desiredLeft = rect.right + PANEL_GAP_PX;

    if (desiredLeft <= maxLeft) {
      left = desiredLeft;
      top = clamp(rect.top, PANEL_MARGIN_PX, maxTop);
    }
  }

  panelNode.style.left = `${Math.round(left)}px`;
  panelNode.style.top = `${Math.round(top)}px`;
}

function scheduleRepositionPanel(refreshNavContainer = false) {
  shouldRefreshNavContainer = shouldRefreshNavContainer || refreshNavContainer;
  if (repositionFrameId !== null) return;

  repositionFrameId = requestAnimationFrame(() => {
    const refresh = shouldRefreshNavContainer;
    repositionFrameId = null;
    shouldRefreshNavContainer = false;
    repositionPanel(refresh);
  });
}

function resolveCandidate(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  if (isWithinExtension(target)) return null;

  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (link && isLikelyDocsNavLink(link)) return link;

  const navItem = target.closest<HTMLAnchorElement>(
    "nav a[href], aside a[href], [role='treeitem'] a[href]"
  );
  return navItem && isLikelyDocsNavLink(navItem) ? navItem : null;
}

function isLikelyDocsNavLink(link: HTMLAnchorElement, rect = link.getBoundingClientRect()) {
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;

  if (rect.width < 12 || rect.height < 8) return false;

  const navContainer = link.closest(
    "nav, aside, [role='navigation'], [role='tree'], [class*='sidebar' i], [class*='sidenav' i], [class*='side-nav' i], [class*='docs-nav' i], [class*='menu' i]"
  );
  if (navContainer) return true;

  const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  const isLeftColumn = rect.left < viewportWidth * 0.38 && rect.width < viewportWidth * 0.45;
  const looksLikeBodyLink = Boolean(link.closest("main, article, [role='main']"));
  return isLeftColumn && !looksLikeBodyLink;
}

function updateSelectionStyles() {
  document.querySelectorAll("[data-nav2md-selected='true']").forEach((node) => {
    node.removeAttribute("data-nav2md-selected");
  });

  selectedItems.forEach((item) => {
    item.element.setAttribute("data-nav2md-selected", "true");
  });
}

function updateHoverBox(target: Element | null) {
  if (!hoverNode) return;
  if (!target) {
    hoverNode.hidden = true;
    return;
  }

  const rect = target.getBoundingClientRect();
  hoverNode.hidden = false;
  hoverNode.style.top = `${rect.top}px`;
  hoverNode.style.left = `${rect.left}px`;
  hoverNode.style.width = `${rect.width}px`;
  hoverNode.style.height = `${rect.height}px`;
}

function scheduleHoverBoxUpdate() {
  if (!selectionEnabled || hoverFrameId !== null) return;

  hoverFrameId = requestAnimationFrame(() => {
    hoverFrameId = null;

    if (!currentTarget?.isConnected) {
      currentTarget = null;
      updateHoverBox(null);
      return;
    }

    updateHoverBox(currentTarget);
  });
}

function getSelectionKey(target: HTMLAnchorElement) {
  return target.href || target.textContent?.trim() || "";
}

function addSelectedItem(target: HTMLAnchorElement) {
  const key = getSelectionKey(target);
  if (!key || selectedItems.has(key)) return false;

  selectedItems.set(key, {
    text: target.textContent?.trim() || "(untitled)",
    href: target.href || "",
    element: target
  });
  return true;
}

function toggleSelectedItem(target: HTMLAnchorElement) {
  const key = getSelectionKey(target);
  if (!key) return;

  if (selectedItems.has(key)) {
    selectedItems.delete(key);
  } else {
    addSelectedItem(target);
  }

  updateSelectionStyles();
  updatePanel();
}

function getBoxSelectionRect(): BoxRect {
  const left = Math.min(boxSelectionState.start.x, boxSelectionState.current.x);
  const top = Math.min(boxSelectionState.start.y, boxSelectionState.current.y);
  const right = Math.max(boxSelectionState.start.x, boxSelectionState.current.x);
  const bottom = Math.max(boxSelectionState.start.y, boxSelectionState.current.y);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top
  };
}

function hasPassedBoxSelectionThreshold() {
  const distanceX = boxSelectionState.current.x - boxSelectionState.start.x;
  const distanceY = boxSelectionState.current.y - boxSelectionState.start.y;
  return Math.hypot(distanceX, distanceY) >= BOX_SELECT_THRESHOLD_PX;
}

function rectsIntersect(a: BoxRect, b: DOMRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function updateBoxSelectionRect() {
  if (!boxSelectNode) return;

  const rect = getBoxSelectionRect();
  boxSelectNode.hidden = false;
  boxSelectNode.style.left = `${Math.round(rect.left)}px`;
  boxSelectNode.style.top = `${Math.round(rect.top)}px`;
  boxSelectNode.style.width = `${Math.round(rect.width)}px`;
  boxSelectNode.style.height = `${Math.round(rect.height)}px`;
}

function releaseBoxSelectionPointerCapture() {
  const pointerId = boxSelectionState.pointerId;
  if (pointerId === null) return;

  try {
    if (document.documentElement.hasPointerCapture(pointerId)) {
      document.documentElement.releasePointerCapture(pointerId);
    }
  } catch {
    // The browser can release capture first during pointer cancellation.
  }
}

function resetBoxSelection(restorePanel = true) {
  releaseBoxSelectionPointerCapture();
  boxSelectionState = {
    phase: "idle",
    start: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    pointerId: null
  };
  document.documentElement.removeAttribute("data-nav2md-box-selecting");
  if (boxSelectNode) boxSelectNode.hidden = true;
  if (restorePanel && panelNode) panelNode.hidden = !selectionEnabled;
}

function beginBoxSelection() {
  boxSelectionState.phase = "dragging";
  document.documentElement.setAttribute("data-nav2md-box-selecting", "true");
  if (panelNode) panelNode.hidden = true;
  currentTarget = null;
  updateHoverBox(null);
  window.getSelection()?.removeAllRanges();
  updateBoxSelectionRect();
}

function cancelBoxSelection() {
  resetBoxSelection(true);
}

function completeBoxSelection() {
  const selectionRect = getBoxSelectionRect();
  const scanRoot: ParentNode = findBestNavContainer() || document;

  scanRoot.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    const rect = link.getBoundingClientRect();
    if (!isLikelyDocsNavLink(link, rect)) return;
    if (!rectsIntersect(selectionRect, rect)) return;

    addSelectedItem(link);
  });

  suppressNextClick = true;
  window.setTimeout(() => {
    suppressNextClick = false;
  }, 0);

  resetBoxSelection(true);
  updateSelectionStyles();
  updatePanel();
}

function captureBoxSelectionPointer(pointerId: number) {
  try {
    document.documentElement.setPointerCapture(pointerId);
  } catch {
    // Pointer capture is best-effort; cancel paths still restore the panel.
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!selectionEnabled || event.button !== 0 || !event.shiftKey) return;
  if (isWithinExtension(event.target)) return;

  boxSelectionState = {
    phase: "pending",
    start: { x: event.clientX, y: event.clientY },
    current: { x: event.clientX, y: event.clientY },
    pointerId: event.pointerId
  };
  captureBoxSelectionPointer(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (!selectionEnabled) return;
  if (
    boxSelectionState.pointerId !== null &&
    event.pointerId !== boxSelectionState.pointerId
  ) {
    return;
  }

  if (boxSelectionState.phase !== "idle") {
    boxSelectionState.current = { x: event.clientX, y: event.clientY };

    if (boxSelectionState.phase === "pending" && hasPassedBoxSelectionThreshold()) {
      beginBoxSelection();
    }

    if (boxSelectionState.phase === "dragging") {
      event.preventDefault();
      event.stopPropagation();
      updateBoxSelectionRect();
    }
    return;
  }

  const candidate = resolveCandidate(event.target);
  currentTarget = candidate;
  updateHoverBox(candidate);
}

function handlePointerUp(event: PointerEvent) {
  if (!selectionEnabled || boxSelectionState.phase === "idle") return;
  if (
    boxSelectionState.pointerId !== null &&
    event.pointerId !== boxSelectionState.pointerId
  ) {
    return;
  }

  boxSelectionState.current = { x: event.clientX, y: event.clientY };

  if (boxSelectionState.phase === "dragging") {
    event.preventDefault();
    event.stopPropagation();
    completeBoxSelection();
    return;
  }

  resetBoxSelection(true);
}

function handlePointerCancel(event: PointerEvent) {
  if (
    boxSelectionState.pointerId !== null &&
    event.pointerId !== boxSelectionState.pointerId
  ) {
    return;
  }

  cancelBoxSelection();
}

function handleDragStart(event: DragEvent) {
  if (!selectionEnabled || boxSelectionState.phase === "idle") return;

  event.preventDefault();
  event.stopPropagation();
}

function handleClick(event: MouseEvent) {
  if (!selectionEnabled) return;
  if (suppressNextClick) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = false;
    return;
  }
  if (isWithinExtension(event.target)) return;

  const clickedTarget = resolveCandidate(event.target);
  if (!clickedTarget) return;

  event.preventDefault();
  event.stopPropagation();
  currentTarget = clickedTarget;
  toggleSelectedItem(clickedTarget);
}

function handleKeyDown(event: KeyboardEvent) {
  if (!selectionEnabled || event.key !== "Escape") return;

  event.preventDefault();
  event.stopPropagation();
  if (boxSelectionState.phase !== "idle") {
    cancelBoxSelection();
    return;
  }
  setSelectionMode(false);
}

function setSelectionMode(enabled: boolean) {
  selectionEnabled = enabled;
  ensureRoot();

  if (panelNode) panelNode.hidden = !enabled;
  if (!enabled) {
    resetBoxSelection(false);
    cachedNavContainer = null;
    currentTarget = null;
    exportRunning = false;
    panelStatus = {
      running: false,
      key: "selectionModeActive"
    };
    updateHoverBox(null);
    selectedItems.clear();
    updateSelectionStyles();
    if (progressNode) {
      progressNode.hidden = true;
      progressNode.textContent = "";
    }
    updatePanel();
    chrome.runtime.sendMessage({ type: "NAV2MD_SELECTION_MODE_CLOSED" }).catch(() => {});
  } else {
    cachedNavContainer = null;
    void hydrateLocalePreference();
    updatePanel();
  }
}

document.addEventListener("pointerdown", handlePointerDown, true);
document.addEventListener("pointermove", handlePointerMove, true);
document.addEventListener("pointerup", handlePointerUp, true);
document.addEventListener("pointercancel", handlePointerCancel, true);
document.addEventListener("dragstart", handleDragStart, true);
document.addEventListener("click", handleClick, true);
document.addEventListener("keydown", handleKeyDown, true);
window.addEventListener("pointerup", handlePointerUp, true);
window.addEventListener("pointercancel", handlePointerCancel, true);
window.addEventListener("blur", cancelBoxSelection);
window.addEventListener("resize", () => scheduleRepositionPanel(true), { passive: true });
window.addEventListener("scroll", () => scheduleRepositionPanel(), { passive: true });
window.addEventListener("resize", scheduleHoverBoxUpdate, { passive: true });
document.addEventListener("scroll", scheduleHoverBoxUpdate, { passive: true, capture: true });

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as { type?: string; enabled?: boolean } | ExportProgressMessage;

  if (message?.type === "NAV2MD_EXPORT_PROGRESS") {
    handleExportProgress(message as ExportProgressMessage);
    sendResponse({ ok: true });
    return;
  }

  if (message?.type !== "NAV2MD_TOGGLE_SELECTION_MODE") return;

  setSelectionMode(Boolean(message.enabled));
  sendResponse({ ok: true });
});

function handleExportProgress(message: ExportProgressMessage) {
  ensureRoot();

  if (message.phase === "started") {
    setPanelStatus({
      running: true,
      key: "exportRunning",
      progress: {
        kind: "plain",
        text: `0 / ${message.total}`
      }
    });
    return;
  }

  if (message.phase === "task-started") {
    setPanelStatus({
      running: true,
      key: "capturing",
      detail: message.task?.title || "Untitled",
      progress: {
        kind: "plain",
        text: `${message.completed || 0} / ${message.total}`
      }
    });
    return;
  }

  if (message.phase === "task-complete") {
    setPanelStatus({
      running: true,
      key: message.result?.ok ? "captured" : "failed",
      detail: message.task?.title || "Untitled",
      progress: {
        kind: "plain",
        text: `${message.completed || 0} / ${message.total}`
      }
    });
    return;
  }

  if (message.phase === "error") {
    setPanelStatus({
      running: false,
      key: "exportError",
      progress: {
        kind: "plain",
        text: message.message || message.reason || "Unknown error"
      }
    });
    return;
  }

  if (message.phase === "finished") {
    if (message.error) {
      setPanelStatus({
        running: false,
        key: "exportError",
        progress: {
          kind: "plain",
          text: message.error.message || message.error.reason || "Unknown error"
        }
      });
      return;
    }

    setPanelStatus({
      running: false,
      key: "exportFinished",
      progress: {
        kind: "summary",
        success: message.success || 0,
        failed: message.failed || 0
      }
    });
  }
}
