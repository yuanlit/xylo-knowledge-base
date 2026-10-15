const DATABASE_NAME = "xylo-knowledge-base";
const STORE_NAME = "settings";
const ROOT_DIRECTORY_KEY = "root-directory";

export interface LibraryConnection {
  handle: FileSystemDirectoryHandle;
  layout: "root" | "docs";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadLibraryConnection(): Promise<LibraryConnection | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(ROOT_DIRECTORY_KEY);
    request.onsuccess = () => {
      database.close();
      const saved = request.result;
      resolve(saved ? (saved.kind === "directory" ? { handle: saved, layout: "docs" } : saved) : null);
    };
    request.onerror = () => {
      database.close();
      reject(request.error);
    };
  });
}

export async function saveLibraryConnection(
  handle: FileSystemDirectoryHandle,
  layout: LibraryConnection["layout"] = "root",
): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ handle, layout }, ROOT_DIRECTORY_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function hasReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
}

export async function requestReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

export async function connectLibrary(
  handle: FileSystemDirectoryHandle,
  layout: LibraryConnection["layout"] = "root",
): Promise<void> {
  if (layout === "docs") await handle.getDirectoryHandle("docs");
  const entries = handle.values();
  try {
    await entries.next();
  } finally {
    await entries.return?.();
  }
}

export async function libraryId(handle: FileSystemDirectoryHandle): Promise<string> {
  return navigator.locks.request("xylo-library-id", () => findOrCreateLibraryId(handle));
}

async function findOrCreateLibraryId(handle: FileSystemDirectoryHandle): Promise<string> {
  const database = await openDatabase();
  try {
    const entries: Array<{ id: string; handle: FileSystemDirectoryHandle }> = await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get("libraries");
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
    for (const entry of entries) {
      try {
        if (await entry.handle.isSameEntry(handle)) return entry.id;
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
      }
    }
    const id = crypto.randomUUID();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put([...entries, { id, handle }], "libraries");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("知识库设置保存失败"));
    });
    return id;
  } finally {
    database.close();
  }
}
