const DB_NAME = "nav2md-zip-artifacts";
const DB_VERSION = 1;
const STORE_NAME = "artifacts";

interface ZipArtifactRecord {
  id: string;
  blob: Blob;
  createdAt: number;
}

function openZipArtifactDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open ZIP artifact store."));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("ZIP artifact transaction aborted."));
    transaction.onerror = () => reject(transaction.error || new Error("ZIP artifact transaction failed."));
  });
}

function getRequestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("ZIP artifact request failed."));
  });
}

export async function writeZipArtifact(id: string, blob: Blob) {
  const db = await openZipArtifactDb();

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.put({ id, blob, createdAt: Date.now() } satisfies ZipArtifactRecord);
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}

export async function purgeZipArtifacts(maxAgeMs: number) {
  const db = await openZipArtifactDb();
  const expiresBefore = Date.now() - maxAgeMs;

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();
    const transactionDone = waitForTransaction(transaction);
    const cursorDone = new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }

        const record = cursor.value as Partial<ZipArtifactRecord>;
        if (typeof record.createdAt !== "number" || record.createdAt <= expiresBefore) {
          cursor.delete();
        }

        cursor.continue();
      };
      request.onerror = () =>
        reject(request.error || new Error("Could not purge ZIP artifacts."));
    });

    await Promise.all([cursorDone, transactionDone]);
  } finally {
    db.close();
  }
}

export async function readZipArtifact(id: string) {
  const db = await openZipArtifactDb();

  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const record = await getRequestResult<ZipArtifactRecord | undefined>(store.get(id));
    await waitForTransaction(transaction);
    return record?.blob instanceof Blob ? record.blob : null;
  } finally {
    db.close();
  }
}

export async function deleteZipArtifact(id: string) {
  const db = await openZipArtifactDb();

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    await waitForTransaction(transaction);
  } finally {
    db.close();
  }
}
