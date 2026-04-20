const ROOT_ID = "nav2md-extension-root";
const PANEL_ID = "nav2md-extension-panel";
const HOVER_ID = "nav2md-extension-hover";
const LIST_ID = "nav2md-extension-selection-list";

let selectionEnabled = false;
let currentTarget = null;
let rootNode = null;
let panelNode = null;
let hoverNode = null;
let countNode = null;
let selectedListNode = null;
let exportButtonNode = null;
const selectedItems = new Map();

function isWithinExtension(node) {
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
    <div id="${LIST_ID}" class="nav2md-panel__list"></div>
    <button class="nav2md-panel__button nav2md-panel__button--secondary" type="button" data-action="export">
      Start export
    </button>
    <button class="nav2md-panel__button" type="button" data-action="exit">Exit</button>
  `;
  rootNode.appendChild(panelNode);

  countNode = panelNode.querySelector(".nav2md-panel__count-value");
  selectedListNode = panelNode.querySelector(`#${LIST_ID}`);
  exportButtonNode = panelNode.querySelector("[data-action='export']");

  panelNode
    .querySelector("[data-action='exit']")
    .addEventListener("click", () => setSelectionMode(false));
  exportButtonNode.addEventListener("click", () => {
    sendExportTasks().catch((error) => {
      console.error("Failed to send export tasks", error);
    });
  });

  return rootNode;
}

function toExportTask(item, index) {
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
  if (selectedItems.size === 0) return;

  const tasks = Array.from(selectedItems.values()).map(toExportTask);
  await chrome.runtime.sendMessage({
    type: "NAV2MD_EXPORT_SELECTIONS",
    tasks
  });
}

function updatePanel() {
  if (countNode) countNode.textContent = String(selectedItems.size);
  if (exportButtonNode) exportButtonNode.disabled = selectedItems.size === 0;
  if (!selectedListNode) return;

  if (selectedItems.size === 0) {
    selectedListNode.innerHTML = `<div class="nav2md-panel__empty">No items selected yet.</div>`;
    return;
  }

  selectedListNode.innerHTML = Array.from(selectedItems.values())
    .map(
      (item) => `
        <div class="nav2md-panel__item" title="${item.href}">
          <div class="nav2md-panel__item-title">${item.text}</div>
          <div class="nav2md-panel__item-url">${item.href}</div>
        </div>
      `
    )
    .join("");
}

function resolveCandidate(target) {
  if (!(target instanceof Element)) return null;
  if (isWithinExtension(target)) return null;

  const link = target.closest("a[href]");
  if (link) return link;

  const navItem = target.closest("nav a[href], aside a[href], [role='treeitem'] a[href]");
  return navItem || null;
}

function updateSelectionStyles() {
  document.querySelectorAll("[data-nav2md-selected='true']").forEach((node) => {
    node.removeAttribute("data-nav2md-selected");
  });

  selectedItems.forEach((item) => {
    item.element.setAttribute("data-nav2md-selected", "true");
  });
}

function updateHoverBox(target) {
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

function getSelectionKey(target) {
  return target.href || target.textContent?.trim() || "";
}

function toggleSelectedItem(target) {
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

function handleMouseMove(event) {
  if (!selectionEnabled) return;

  const candidate = resolveCandidate(event.target);
  currentTarget = candidate;
  updateHoverBox(candidate);
}

function handleClick(event) {
  if (!selectionEnabled || !currentTarget) return;
  if (isWithinExtension(event.target)) return;

  event.preventDefault();
  event.stopPropagation();
  toggleSelectedItem(currentTarget);
}

function setSelectionMode(enabled) {
  selectionEnabled = enabled;
  ensureRoot();

  if (panelNode) panelNode.hidden = !enabled;
  if (!enabled) {
    currentTarget = null;
    updateHoverBox(null);
    selectedItems.clear();
    updateSelectionStyles();
    updatePanel();
    chrome.runtime.sendMessage({ type: "NAV2MD_SELECTION_MODE_CLOSED" }).catch(() => {});
  } else {
    updatePanel();
  }
}

document.addEventListener("mousemove", handleMouseMove, true);
document.addEventListener("click", handleClick, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "NAV2MD_TOGGLE_SELECTION_MODE") return;

  setSelectionMode(Boolean(message.enabled));
  sendResponse({ ok: true });
});
