import { deleteZipArtifact, readZipArtifact } from "../export/zip-artifact-store.js";

const CREATE_ZIP_BLOB_URL_MESSAGE_TYPE = "NAV2MD_CREATE_ZIP_BLOB_URL";
const REVOKE_BLOB_URL_MESSAGE_TYPE = "NAV2MD_REVOKE_BLOB_URL";

const activeUrls = new Set<string>();

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isArtifactId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

async function createZipBlobUrl(artifactId: unknown) {
  if (!isArtifactId(artifactId)) {
    throw new Error("Invalid ZIP artifact id.");
  }

  try {
    const zipBlob = await readZipArtifact(artifactId);
    if (!zipBlob) {
      throw new Error("ZIP artifact was not found.");
    }

    const url = URL.createObjectURL(zipBlob);
    activeUrls.add(url);
    return url;
  } finally {
    await deleteZipArtifact(artifactId).catch((error) => {
      console.debug("nav2md could not delete ZIP artifact", {
        message: getErrorMessage(error)
      });
    });
  }
}

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const message = rawMessage as { type?: string; artifactId?: unknown; url?: unknown };

  if (message?.type === CREATE_ZIP_BLOB_URL_MESSAGE_TYPE) {
    createZipBlobUrl(message.artifactId)
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
