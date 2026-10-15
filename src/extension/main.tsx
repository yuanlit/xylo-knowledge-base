import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { KnowledgeBaseApp } from "@/components/knowledge-base-app";
import { LibraryRepositoryProvider } from "@/contexts/library-repository-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { ThemeColorUpdater } from "@/components/theme-color-updater";
import { BrandIcon } from "@/components/brand-icon";
import { showToast } from "@/lib/toast";
import {
  hasReadWritePermission,
  loadLibraryConnection,
  requestReadWritePermission,
  saveLibraryConnection,
  connectLibrary,
  libraryId,
} from "@/lib/directory-handle-store";
import type { LibraryConnection } from "@/lib/directory-handle-store";
import { FileSystemLibraryRepository } from "@/repositories/file-system-library-repository";
import type { LibraryRepository } from "@/repositories/library-repository";
import "@/styles/globals.css";

function DirectoryConnection({
  onConnected,
}: {
  onConnected: (repository: LibraryRepository) => void;
}) {
  const [savedDirectory, setSavedDirectory] =
    useState<LibraryConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadLibraryConnection()
      .then(async (connection) => {
        if (!connection || !active) return;
        setSavedDirectory(connection);
        const { handle: directory, layout } = connection;
        if (await hasReadWritePermission(directory)) {
          await connectLibrary(directory, layout);
          const id = await libraryId(directory);
          if (active) onConnected(new FileSystemLibraryRepository(directory, id, layout));
        }
      })
      .catch((reason) => {
        console.error("Failed to restore directory:", reason);
        if (active) setError("无法恢复上次选择的目录，请重新选择");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onConnected]);

  const connect = async (restore = false) => {
    setError("");
    setLoading(true);
    try {
      const connection: LibraryConnection = restore && savedDirectory
        ? savedDirectory
        : { handle: await window.showDirectoryPicker({ mode: "readwrite" }), layout: "root" };
      const { handle: directory, layout } = connection;
      if (restore && !(await requestReadWritePermission(directory))) throw new Error("未获得知识库读写权限");
      await connectLibrary(directory, layout);
      const id = await libraryId(directory);
      await saveLibraryConnection(directory, layout);
      onConnected(new FileSystemLibraryRepository(directory, id, layout));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "目录连接失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-white px-6 text-gray-900 dark:bg-slate-950 dark:text-white">
      <section className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6">
          <BrandIcon size={48} />
        </div>
        <h1 className="text-xl font-semibold">连接 Xylo 本地知识库</h1>
        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
          选择知识库目录
        </p>
        <button
          type="button"
          onClick={() => connect(Boolean(savedDirectory))}
          disabled={loading}
          className="mt-6 w-full rounded bg-[#087e91] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#066575] disabled:cursor-wait disabled:opacity-60"
        >
          {loading
            ? "正在恢复目录..."
            : savedDirectory
              ? "重新授权知识库"
              : "选择知识库目录"}
        </button>
        {savedDirectory && <button type="button" disabled={loading} onClick={() => connect()} className="mt-3 w-full py-2 text-sm underline disabled:opacity-60">选择其他知识库</button>}
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>
    </main>
  );
}

function ExtensionApp() {
  const [repository, setRepository] = useState<LibraryRepository | null>(null);
  const [locationSearch, setLocationSearch] = useState(window.location.search);
  const searchParams = useMemo(
    () => new URLSearchParams(locationSearch),
    [locationSearch],
  );
  const handleConnected = useCallback(
    (connectedRepository: LibraryRepository) =>
      setRepository(connectedRepository),
    [],
  );
  const switchLibrary = async () => {
    try {
      const directory = await window.showDirectoryPicker({ mode: "readwrite" });
      await connectLibrary(directory);
      const id = await libraryId(directory);
      await saveLibraryConnection(directory);
      window.history.replaceState({}, "", window.location.pathname);
      setLocationSearch("");
      setRepository(new FileSystemLibraryRepository(directory, id));
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      showToast.error(reason instanceof Error ? reason.message : "切换知识库失败");
    }
  };

  useEffect(() => {
    const handlePopState = () => setLocationSearch(window.location.search);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((url: string) => {
    const target = new URL(url, window.location.href);
    window.history.pushState({}, "", `${window.location.pathname}${target.search}`);
    setLocationSearch(target.search);
  }, []);

  return (
    <ThemeProvider>
      <ThemeColorUpdater />
      {repository ? (
        <LibraryRepositoryProvider key={repository.storageKey} repository={repository}>
          <KnowledgeBaseApp searchParams={searchParams} navigate={navigate} onSwitchLibrary={switchLibrary} />
        </LibraryRepositoryProvider>
      ) : (
        <DirectoryConnection onConnected={handleConnected} />
      )}
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  );
}

createRoot(document.querySelector("#root")!).render(
  <StrictMode>
    <ExtensionApp />
  </StrictMode>,
);
