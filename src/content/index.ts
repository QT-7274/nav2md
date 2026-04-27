const ROOT_ID = "nav2md-extension-root";
const PANEL_ID = "nav2md-extension-panel";
const HOVER_ID = "nav2md-extension-hover";
const LIST_ID = "nav2md-extension-selection-list";

interface SelectedItem {
  text: string;
  href: string;
  element: HTMLAnchorElement;
}

interface ExportStatus {
  running: boolean;
  status: string;
  progress?: string;
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
}

let selectionEnabled = false;
let currentTarget: HTMLAnchorElement | null = null;
let rootNode: HTMLDivElement | null = null;
let panelNode: HTMLDivElement | null = null;
let hoverNode: HTMLDivElement | null = null;
let countNode: HTMLElement | null = null;
let statusNode: HTMLElement | null = null;
let progressNode: HTMLElement | null = null;
let selectedListNode: HTMLElement | null = null;
let exportButtonNode: HTMLButtonElement | null = null;
const selectedItems = new Map<string, SelectedItem>();
let exportRunning = false;

function isWithinExtension(node: EventTarget | null) {
  return node instanceof Element && node.closest(`#${ROOT_ID}`);
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

  panelNode = document.createElement("div");
  panelNode.id = PANEL_ID;
  panelNode.innerHTML = `
    <div class="nav2md-panel__title">nav2md</div>
    <div class="nav2md-panel__status">Selection mode active</div>
    <div class="nav2md-panel__meta">
      <span class="nav2md-panel__count-label">Selected</span>
      <span class="nav2md-panel__count-value">0</span>
    </div>
    <div class="nav2md-panel__progress" hidden></div>
    <div id="${LIST_ID}" class="nav2md-panel__list"></div>
    <button class="nav2md-panel__button nav2md-panel__button--secondary" type="button" data-action="export">
      Start export
    </button>
    <button class="nav2md-panel__button" type="button" data-action="exit">Exit</button>
  `;
  rootNode.appendChild(panelNode);

  countNode = panelNode.querySelector(".nav2md-panel__count-value");
  statusNode = panelNode.querySelector(".nav2md-panel__status");
  progressNode = panelNode.querySelector(".nav2md-panel__progress");
  selectedListNode = panelNode.querySelector(`#${LIST_ID}`);
  exportButtonNode = panelNode.querySelector<HTMLButtonElement>("[data-action='export']");

  panelNode
    .querySelector("[data-action='exit']")
    ?.addEventListener("click", () => setSelectionMode(false));
  exportButtonNode?.addEventListener("click", () => {
    sendExportTasks().catch((error) => {
      console.error("Failed to send export tasks", error);
    });
  });

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
  setExportStatus({
    running: true,
    status: "Starting export...",
    progress: `0 / ${tasks.length}`
  });

  const response = await chrome.runtime.sendMessage({
    type: "NAV2MD_EXPORT_SELECTIONS",
    tasks
  });

  if (!response?.ok) {
    setExportStatus({
      running: false,
      status: "Export could not start.",
      progress: response?.reason || "Unknown error"
    });
  }
}

function setExportStatus({ running, status, progress }: ExportStatus) {
  exportRunning = running;
  if (statusNode) statusNode.textContent = status;
  if (progressNode) {
    progressNode.hidden = !progress;
    progressNode.textContent = progress || "";
  }
  updatePanel();
}

function updatePanel() {
  if (countNode) countNode.textContent = String(selectedItems.size);
  if (exportButtonNode) {
    exportButtonNode.disabled = selectedItems.size === 0 || exportRunning;
    exportButtonNode.textContent = exportRunning ? "Exporting..." : "Start export";
  }
  const listNode = selectedListNode;
  if (!listNode) return;

  listNode.replaceChildren();

  if (selectedItems.size === 0) {
    const emptyNode = document.createElement("div");
    emptyNode.className = "nav2md-panel__empty";
    emptyNode.textContent = "No items selected yet.";
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

function isLikelyDocsNavLink(link: HTMLAnchorElement) {
  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;

  const rect = link.getBoundingClientRect();
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
  hoverNode.style.top = `${rect.top + window.scrollY}px`;
  hoverNode.style.left = `${rect.left + window.scrollX}px`;
  hoverNode.style.width = `${rect.width}px`;
  hoverNode.style.height = `${rect.height}px`;
}

function getSelectionKey(target: HTMLAnchorElement) {
  return target.href || target.textContent?.trim() || "";
}

function toggleSelectedItem(target: HTMLAnchorElement) {
  const key = getSelectionKey(target);
  if (!key) return;

  if (selectedItems.has(key)) {
    selectedItems.delete(key);
  } else {
    selectedItems.set(key, {
      text: target.textContent?.trim() || "(untitled)",
      href: target.href || "",
      element: target
    });
  }

  updateSelectionStyles();
  updatePanel();
}

function handleMouseMove(event: MouseEvent) {
  if (!selectionEnabled) return;

  const candidate = resolveCandidate(event.target);
  currentTarget = candidate;
  updateHoverBox(candidate);
}

function handleClick(event: MouseEvent) {
  if (!selectionEnabled) return;
  if (isWithinExtension(event.target)) return;

  const clickedTarget = resolveCandidate(event.target);
  if (!clickedTarget) return;

  event.preventDefault();
  event.stopPropagation();
  currentTarget = clickedTarget;
  toggleSelectedItem(clickedTarget);
}

function setSelectionMode(enabled: boolean) {
  selectionEnabled = enabled;
  ensureRoot();

  if (panelNode) panelNode.hidden = !enabled;
  if (!enabled) {
    currentTarget = null;
    exportRunning = false;
    updateHoverBox(null);
    selectedItems.clear();
    updateSelectionStyles();
    if (statusNode) statusNode.textContent = "Selection mode active";
    if (progressNode) {
      progressNode.hidden = true;
      progressNode.textContent = "";
    }
    updatePanel();
    chrome.runtime.sendMessage({ type: "NAV2MD_SELECTION_MODE_CLOSED" }).catch(() => {});
  } else {
    updatePanel();
  }
}

document.addEventListener("mousemove", handleMouseMove, true);
document.addEventListener("click", handleClick, true);

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
    setExportStatus({
      running: true,
      status: "Export running",
      progress: `0 / ${message.total}`
    });
    return;
  }

  if (message.phase === "task-started") {
    setExportStatus({
      running: true,
      status: `Capturing: ${message.task?.title || "Untitled"}`,
      progress: `${message.completed || 0} / ${message.total}`
    });
    return;
  }

  if (message.phase === "task-complete") {
    const resultLabel = message.result?.ok ? "Captured" : "Failed";
    setExportStatus({
      running: true,
      status: `${resultLabel}: ${message.task?.title || "Untitled"}`,
      progress: `${message.completed || 0} / ${message.total}`
    });
    return;
  }

  if (message.phase === "error") {
    setExportStatus({
      running: false,
      status: "Export error",
      progress: message.message || message.reason || "Unknown error"
    });
    return;
  }

  if (message.phase === "finished") {
    setExportStatus({
      running: false,
      status: "Export finished",
      progress: `${message.success || 0} exported, ${message.failed || 0} failed`
    });
  }
}
