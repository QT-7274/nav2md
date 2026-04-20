const enabledTabs = new Set();

function setBadge(tabId, enabled) {
  chrome.action.setBadgeText({
    tabId,
    text: enabled ? "ON" : ""
  });
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: enabled ? "#0f766e" : "#64748b"
  });
}

async function sendToggle(tabId, enabled) {
  await chrome.tabs.sendMessage(tabId, {
    type: "NAV2MD_TOGGLE_SELECTION_MODE",
    enabled
  });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const nextEnabled = !enabledTabs.has(tab.id);

  try {
    await sendToggle(tab.id, nextEnabled);

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
    console.info("nav2md received export tasks", {
      fromTabId: sender.tab?.id ?? null,
      taskCount: Array.isArray(message.tasks) ? message.tasks.length : 0,
      tasks: message.tasks ?? []
    });
    sendResponse({ ok: true });
  }
});
