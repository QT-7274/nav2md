import { startExportJob } from "./export-runtime.js";

const enabledTabs = new Set<number>();
const CONTENT_SCRIPT_FILE = "src/content/index.js";
const CONTENT_STYLE_FILE = "src/content/overlay.css";

function setBadge(tabId: number, enabled: boolean) {
  chrome.action.setBadgeText({
    tabId,
    text: enabled ? "ON" : ""
  });
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: enabled ? "#0f766e" : "#64748b"
  });
}

async function ensureContentScript(tab: chrome.tabs.Tab) {
  if (!tab.id) return;
  if (!isInjectableTabUrl(tab.url)) {
    throw new Error("nav2md can only run on regular http, https, or file pages.");
  }

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: [CONTENT_STYLE_FILE]
  });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [CONTENT_SCRIPT_FILE]
  });
}

function isInjectableTabUrl(url: string | undefined) {
  if (!url) return false;

  try {
    return ["http:", "https:", "file:"].includes(new URL(url).protocol);
  } catch (_error) {
    return false;
  }
}

function isMissingReceiverError(error: unknown) {
  return error instanceof Error && error.message.includes("Receiving end does not exist");
}

async function sendToggle(tab: chrome.tabs.Tab, enabled: boolean) {
  if (!tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "NAV2MD_TOGGLE_SELECTION_MODE",
      enabled
    });
    return;
  } catch (error) {
    if (!isMissingReceiverError(error)) throw error;
  }

  await ensureContentScript(tab);
  await chrome.tabs.sendMessage(tab.id, {
    type: "NAV2MD_TOGGLE_SELECTION_MODE",
    enabled
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const nextEnabled = !enabledTabs.has(tab.id);

  try {
    await sendToggle(tab, nextEnabled);

    if (nextEnabled) enabledTabs.add(tab.id);
    else enabledTabs.delete(tab.id);

    setBadge(tab.id, nextEnabled);
  } catch (error) {
    console.error("Failed to toggle nav2md selection mode", error);
    enabledTabs.delete(tab.id);
    setBadge(tab.id, false);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enabledTabs.delete(tabId);
});

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  const message = rawMessage as { type?: string; tasks?: unknown };

  if (message?.type === "NAV2MD_SELECTION_MODE_CLOSED") {
    const tabId = sender.tab?.id;
    if (tabId) {
      enabledTabs.delete(tabId);
      setBadge(tabId, false);
    }
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "NAV2MD_EXPORT_SELECTIONS") {
    sendResponse(
      startExportJob({
        tasks: message.tasks,
        sourceTabId: sender.tab?.id ?? null,
        sourceUrl: sender.tab?.url ?? ""
      })
    );
  }
});
