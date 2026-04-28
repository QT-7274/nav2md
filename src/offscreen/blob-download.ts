const CREATE_ZIP_BLOB_URL_MESSAGE_TYPE = "NAV2MD_CREATE_ZIP_BLOB_URL";
const REVOKE_BLOB_URL_MESSAGE_TYPE = "NAV2MD_REVOKE_BLOB_URL";

const activeUrls = new Set<string>();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isZipArtifact(value: unknown): value is Blob | ArrayBuffer {
  return value instanceof Blob || value instanceof ArrayBuffer;
}

function createZipBlobUrl(zipArtifact: unknown) {
  if (!isZipArtifact(zipArtifact)) {
    throw new Error("Invalid ZIP artifact payload.");
  }

  const zipBlob =
    zipArtifact instanceof Blob
      ? zipArtifact
      : new Blob([zipArtifact], { type: "application/zip" });
  const url = URL.createObjectURL(zipBlob);
  activeUrls.add(url);
  return url;
}

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as { type?: string; zipBlob?: unknown; url?: unknown };

  if (message?.type === CREATE_ZIP_BLOB_URL_MESSAGE_TYPE) {
    try {
      const url = createZipBlobUrl(message.zipBlob);
      sendResponse({ ok: true, url });
    } catch (error) {
      sendResponse({ ok: false, message: getErrorMessage(error) });
    }
    return;
  }

  if (message?.type === REVOKE_BLOB_URL_MESSAGE_TYPE) {
    if (typeof message.url === "string" && activeUrls.delete(message.url)) {
      URL.revokeObjectURL(message.url);
    }

    sendResponse({ ok: true, activeUrlCount: activeUrls.size });
  }
});
