import { createZipBlob, type ZipFile } from "../export/zip.js";

const CREATE_ZIP_BLOB_URL_MESSAGE_TYPE = "NAV2MD_CREATE_ZIP_BLOB_URL";
const REVOKE_BLOB_URL_MESSAGE_TYPE = "NAV2MD_REVOKE_BLOB_URL";

const activeUrls = new Set<string>();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isZipFile(value: unknown): value is ZipFile {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as ZipFile).name === "string" &&
    typeof (value as ZipFile).content === "string"
  );
}

async function createZipBlobUrl(files: unknown) {
  if (!Array.isArray(files) || !files.every(isZipFile)) {
    throw new Error("Invalid ZIP file payload.");
  }

  const zipBlob = await createZipBlob(files);
  const url = URL.createObjectURL(zipBlob);
  activeUrls.add(url);
  return url;
}

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as { type?: string; files?: unknown; url?: unknown };

  if (message?.type === CREATE_ZIP_BLOB_URL_MESSAGE_TYPE) {
    createZipBlobUrl(message.files)
      .then((url) => sendResponse({ ok: true, url }))
      .catch((error) => sendResponse({ ok: false, message: getErrorMessage(error) }));
    return true;
  }

  if (message?.type === REVOKE_BLOB_URL_MESSAGE_TYPE) {
    if (typeof message.url === "string" && activeUrls.delete(message.url)) {
      URL.revokeObjectURL(message.url);
    }

    sendResponse({ ok: true, activeUrlCount: activeUrls.size });
  }
});
