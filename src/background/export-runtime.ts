import { createMarkdownFilenames } from "../export/filenames.js";
import { createZipBlob } from "../export/zip.js";
import type {
  ExportFailure,
  ExportManifest,
  ExportResult,
  ExportResultItem,
  ExportTask,
  ExtractionResult,
  StartExportJobInput,
  StartExportJobResponse
} from "../shared/types";

const PROGRESS_MESSAGE_TYPE = "NAV2MD_EXPORT_PROGRESS";
const CAPTURE_TIMEOUT_MS = 30000;
const CAPTURE_STABILIZE_MS = 1200;
const EXTRACTOR_SCRIPT_FILE = "src/extractor/page-extractor.js";

interface ExportJob {
  id: string;
  sourceTabId: number | null;
  sourceUrl: string;
  tasks: ExportTask[];
}

interface CaptureTaskResult {
  captureTabId: number | null;
  result: ExportResult;
}

type ProgressPayload = Record<string, unknown> & {
  phase: string;
};

let activeJob: ExportJob | null = null;
let nextJobSequence = 1;

function createJobId() {
  const sequence = String(nextJobSequence).padStart(4, "0");
  nextJobSequence += 1;
  return `export_${Date.now()}_${sequence}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSourceTextPath(value: unknown, fallbackTitle: string) {
  if (Array.isArray(value)) {
    const path = value.map((part) => normalizeText(part)).filter(Boolean);
    if (path.length > 0) return path;
  }

  const fallback = normalizeText(fallbackTitle);
  return fallback ? [fallback] : [];
}

function normalizeTaskUrl(value: unknown, baseUrl: string) {
  const rawUrl = normalizeText(value);
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl, baseUrl || undefined);
    if (!["http:", "https:", "file:"].includes(url.protocol)) return null;
    return url.href;
  } catch (_error) {
    return null;
  }
}

function normalizeOrder(value: unknown, fallbackOrder: number) {
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && numberValue > 0) {
    return Math.trunc(numberValue);
  }
  return fallbackOrder;
}

function normalizeExportTasks(
  tasks: unknown,
  baseUrl: string
): { ok: true; tasks: ExportTask[] } | { ok: false; reason: string; errors: string[] } {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return {
      ok: false,
      reason: "invalid-tasks",
      errors: ["tasks must be a non-empty array"]
    };
  }

  const errors: string[] = [];
  const normalizedTasks = tasks.map((task, index): ExportTask | null => {
    const fallbackOrder = index + 1;

    if (!isPlainObject(task)) {
      errors.push(`task ${fallbackOrder} must be an object`);
      return null;
    }

    const url = normalizeTaskUrl(task.url, baseUrl);
    if (!url) {
      errors.push(`task ${fallbackOrder} must include a valid url`);
      return null;
    }

    const title = normalizeText(task.title) || url;
    const order = normalizeOrder(task.order, fallbackOrder);

    return {
      id: normalizeText(task.id) || `task_${String(fallbackOrder).padStart(3, "0")}`,
      title,
      url,
      order,
      sourceTextPath: normalizeSourceTextPath(task.sourceTextPath, title),
      selectionMeta: isPlainObject(task.selectionMeta) ? { ...task.selectionMeta } : {}
    };
  });

  if (errors.length > 0) {
    return {
      ok: false,
      reason: "invalid-tasks",
      errors
    };
  }

  return {
    ok: true,
    tasks: normalizedTasks.filter((task): task is ExportTask => task !== null)
  };
}

async function sendProgress(tabId: number | null, payload: ProgressPayload) {
  if (typeof tabId !== "number" || !Number.isInteger(tabId)) return;

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: PROGRESS_MESSAGE_TYPE,
      ...payload
    });
  } catch (error) {
    console.debug("nav2md export progress delivery skipped", {
      phase: payload.phase,
      tabId,
      message: getErrorMessage(error)
    });
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabComplete(tabId: number) {
  let settled = false;

  function cleanup() {
    clearTimeout(timeoutId);
    chrome.tabs.onUpdated.removeListener(handleUpdated);
  }

  function handleUpdated(updatedTabId: number, changeInfo: { status?: string }) {
    if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
    cleanup();
    settled = true;
    resolvePromise();
  }

  let resolvePromise: () => void = () => {};
  let rejectPromise: (error: Error) => void = () => {};

  const timeoutId = setTimeout(() => {
    if (settled) return;
    cleanup();
    settled = true;
    rejectPromise(new Error("Timed out waiting for capture tab to finish loading."));
  }, CAPTURE_TIMEOUT_MS);

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  chrome.tabs.onUpdated.addListener(handleUpdated);

  return {
    promise,
    dispose() {
      if (!settled) {
        settled = true;
        cleanup();
      }
    }
  };
}

function normalizeComparableUrl(value: string) {
  try {
    return new URL(value).href;
  } catch (_error) {
    return "";
  }
}

function isInjectableUrl(value: string | undefined) {
  if (!value) return false;

  try {
    return ["http:", "https:", "file:"].includes(new URL(value).protocol);
  } catch (_error) {
    return false;
  }
}

async function findOpenTabForUrl(url: string, excludedTabId: number | null) {
  const comparableUrl = normalizeComparableUrl(url);
  if (!comparableUrl) return null;

  const tabs = await chrome.tabs.query({});
  return (
    tabs.find((tab) => {
      if (typeof tab.id !== "number" || !Number.isInteger(tab.id)) return false;
      if (tab.id === excludedTabId) return false;
      if (!isInjectableUrl(tab.url)) return false;

      return normalizeComparableUrl(tab.url || "") === comparableUrl;
    }) || null
  );
}

async function createOrUpdateCaptureTab(captureTabId: number | null, url: string) {
  let targetTabId: number | null = captureTabId;

  if (!Number.isInteger(targetTabId)) {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    targetTabId = tab.id ?? null;
  }

  if (typeof targetTabId !== "number" || !Number.isInteger(targetTabId)) {
    throw new Error("Chrome did not return a capture tab id.");
  }

  const tabId: number = targetTabId;

  try {
    await navigateCaptureTab(tabId, url);
    return tabId;
  } catch (error) {
    if (Number.isInteger(captureTabId)) {
      const tab = await chrome.tabs.create({ url: "about:blank", active: false });
      if (!tab.id) throw error;
      await navigateCaptureTab(tab.id, url);
      return tab.id;
    }
    throw error;
  }
}

async function navigateCaptureTab(tabId: number, url: string) {
  const loading = waitForTabComplete(tabId);

  try {
    await chrome.tabs.update(tabId, { url, active: false });
    await loading.promise;
  } finally {
    loading.dispose();
  }
}

async function captureTask(task: ExportTask, captureTabId: number | null): Promise<CaptureTaskResult> {
  const openTab = await findOpenTabForUrl(task.url, captureTabId);
  if (openTab?.id) {
    try {
      if (openTab.status === "loading") {
        const loading = waitForTabComplete(openTab.id);
        try {
          await loading.promise;
        } finally {
          loading.dispose();
        }
      }

      await delay(CAPTURE_STABILIZE_MS);

      return {
        captureTabId,
        result: await extractTaskFromTab(task, openTab.id, "open-tab")
      };
    } catch (error) {
      console.debug("nav2md open tab capture failed, falling back to capture tab", {
        taskId: task.id,
        tabId: openTab.id,
        message: getErrorMessage(error)
      });
    }
  }

  const nextCaptureTabId = await createOrUpdateCaptureTab(captureTabId, task.url);
  await delay(CAPTURE_STABILIZE_MS);

  return {
    captureTabId: nextCaptureTabId,
    result: await extractTaskFromTab(task, nextCaptureTabId, "capture-tab")
  };
}

async function extractTaskFromTab(
  task: ExportTask,
  tabId: number,
  captureSource: "open-tab" | "capture-tab"
): Promise<ExportResult> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [EXTRACTOR_SCRIPT_FILE]
  });

  const injectionResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: runInjectedPageExtractor
  });
  const extraction = injectionResults?.[0]?.result as ExtractionResult | undefined;

  if (!extraction?.ok) {
    return {
      ok: false,
      reason: extraction?.reason || "extraction-failed",
      message: extraction?.message || "Could not extract docs content.",
      taskId: task.id,
      url: task.url,
      diagnostics: {
        captureSource,
        extraction: extraction || null
      }
    };
  }

  return {
    ok: true,
    taskId: task.id,
    url: extraction.url || task.url,
    title: extraction.title || task.title,
    markdown: extraction.markdown,
    diagnostics: {
      captureSource,
      selector: extraction.selector,
      htmlLength: extraction.htmlLength,
      markdownLength: extraction.markdownLength
    }
  };
}

function runInjectedPageExtractor(): ExtractionResult {
  const nav2mdGlobal = globalThis as typeof globalThis & {
    nav2mdExtractPageContent?: () => ExtractionResult;
  };

  if (typeof nav2mdGlobal.nav2mdExtractPageContent !== "function") {
    return {
      ok: false,
      reason: "extractor-not-registered",
      message: "The nav2md extractor script was injected but did not register.",
      url: location.href,
      title: document.title
    };
  }

  return nav2mdGlobal.nav2mdExtractPageContent();
}

function buildManifest(job: ExportJob, items: ExportResultItem[]): ExportManifest {
  return {
    schemaVersion: 1,
    jobId: job.id,
    createdAt: new Date().toISOString(),
    sourceUrl: job.sourceUrl,
    total: items.length,
    success: items.filter((item) => item.result.ok).length,
    failed: items.filter((item) => !item.result.ok).length,
    items: items.map((item) => ({
      id: item.task.id,
      order: item.task.order,
      title: item.result.ok ? item.result.title : item.task.title,
      sourceUrl: item.task.url,
      capturedUrl: item.result.url || null,
      ok: item.result.ok,
      filename: item.filename || null,
      sourceTextPath: item.task.sourceTextPath,
      error: item.result.ok
        ? null
        : {
            reason: item.result.reason,
            message: item.result.message
          },
      diagnostics: item.result.diagnostics || null
    }))
  };
}

async function downloadZip(job: ExportJob, items: ExportResultItem[]) {
  const successfulItems = items.filter(
    (item): item is ExportResultItem & { result: Extract<ExportResult, { ok: true }> } =>
      item.result.ok
  );
  const filenames = createMarkdownFilenames(successfulItems.map((item) => item.task));
  successfulItems.forEach((item, index) => {
    item.filename = filenames[index] || `${item.task.id}.md`;
  });

  const manifest = buildManifest(job, items);
  const files = [
    ...successfulItems.map((item) => ({
      name: item.filename || `${item.task.id}.md`,
      content: `# ${item.result.title || item.task.title}\n\nSource: ${item.result.url || item.task.url}\n\n${item.result.markdown}\n`
    })),
    {
      name: "manifest.json",
      content: `${JSON.stringify(manifest, null, 2)}\n`
    }
  ];

  const zipBlob = await createZipBlob(files);
  const objectUrl = URL.createObjectURL(zipBlob);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  try {
    await chrome.downloads.download({
      url: objectUrl,
      filename: `nav2md-export-${timestamp}.zip`,
      saveAs: true
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }

  return manifest;
}

async function runExportJob(job: ExportJob) {
  const total = job.tasks.length;
  const items: ExportResultItem[] = [];
  let captureTabId: number | null = null;

  console.info("nav2md export started", {
    jobId: job.id,
    total
  });

  await sendProgress(job.sourceTabId, {
    phase: "started",
    jobId: job.id,
    total
  });

  for (const task of job.tasks) {
    await sendProgress(job.sourceTabId, {
      phase: "task-started",
      jobId: job.id,
      completed: items.length,
      total,
      task
    });

    let result: ExportResult;

    try {
      const capture = await captureTask(task, captureTabId);
      captureTabId = capture.captureTabId;
      result = capture.result;
    } catch (error) {
      result = {
        ok: false,
        reason: "task-runtime-error",
        message: getErrorMessage(error),
        taskId: task.id,
        url: task.url
      } satisfies ExportFailure;
    }

    items.push({
      task,
      result
    });

    await sendProgress(job.sourceTabId, {
      phase: "task-complete",
      jobId: job.id,
      completed: items.length,
      total,
      task,
      result
    });
  }

  let manifest: ExportManifest | null = null;
  try {
    manifest = await downloadZip(job, items);
  } catch (error) {
    await sendProgress(job.sourceTabId, {
      phase: "error",
      jobId: job.id,
      reason: "download-failed",
      message: getErrorMessage(error),
      total,
      success: items.filter((item) => item.result.ok).length,
      failed: items.filter((item) => !item.result.ok).length
    });
    console.error("nav2md export download failed", {
      jobId: job.id,
      message: getErrorMessage(error)
    });
    return;
  } finally {
    if (typeof captureTabId === "number" && Number.isInteger(captureTabId)) {
      chrome.tabs.remove(captureTabId).catch(() => {});
    }
  }

  await sendProgress(job.sourceTabId, {
    phase: "finished",
    jobId: job.id,
    total,
    success: manifest.success,
    failed: manifest.failed,
    manifest
  });

  console.info("nav2md export finished", {
    jobId: job.id,
    total,
    success: manifest.success,
    failed: manifest.failed
  });
}

async function runJobAndRelease(job: ExportJob) {
  try {
    await runExportJob(job);
  } catch (error) {
    console.error("nav2md export failed", {
      jobId: job.id,
      message: getErrorMessage(error)
    });

    await sendProgress(job.sourceTabId, {
      phase: "error",
      jobId: job.id,
      reason: "job-runtime-error",
      message: getErrorMessage(error),
      total: job.tasks.length,
      success: 0,
      failed: job.tasks.length
    });
  } finally {
    if (activeJob?.id === job.id) activeJob = null;
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function startExportJob({
  tasks,
  sourceTabId,
  sourceUrl
}: StartExportJobInput): StartExportJobResponse {
  if (activeJob) {
    sendProgress(sourceTabId, {
      phase: "error",
      jobId: activeJob.id,
      reason: "export-in-progress",
      message: "An export job is already running."
    });

    return {
      ok: false,
      reason: "export-in-progress",
      jobId: activeJob.id
    };
  }

  const normalized = normalizeExportTasks(tasks, sourceUrl);
  if (!normalized.ok) {
    return normalized;
  }

  const job = {
    id: createJobId(),
    sourceTabId,
    sourceUrl,
    tasks: normalized.tasks
  };

  activeJob = job;
  queueMicrotask(() => {
    runJobAndRelease(job);
  });

  return {
    ok: true,
    jobId: job.id,
    taskCount: job.tasks.length
  };
}
