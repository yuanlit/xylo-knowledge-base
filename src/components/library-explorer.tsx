"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Fuse from "fuse.js";
import { ChevronRight, Clock3, Database, FolderOpen, Layers2, Layers3, LockKeyhole, LockKeyholeOpen, PanelLeftClose, PanelLeftOpen, Search, X, FilePlus2, FolderPlus, PencilLine, Trash2 } from "lucide-react";
import { VisualEffectsToggle } from "@/components/visual-effects-toggle";
import { BrandIcon } from "@/components/brand-icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/contexts/theme-context";
import { PasswordModal } from "@/components/password-modal";
import { FileContextMenu, type FileMenuAction } from "@/components/file-context-menu";
import { IconButton } from "@/components/icon-button";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import { getFileStrategy } from "@/strategies/file-strategy";
import type { LibraryFile } from "@/types/library-file";

const UNLOCKED_FILES_KEY = "unlockedDocuments";
const UNLOCK_DURATION = 60 * 60 * 1000;
const RECENT_FILES_KEY = "recentDocuments";
const RECENT_FILES_LIMIT = 4;

const storageKey = (base: string, scope?: string) => `${base}:${scope || "default"}`;
const isFileUnlocked = (docId: string, scope?: string): boolean => {
  try {
    const unlockedData = localStorage.getItem(storageKey(UNLOCKED_FILES_KEY, scope));
    if (!unlockedData) return false;

    const unlockInfo = JSON.parse(unlockedData)[docId];
    return Boolean(
      unlockInfo && Date.now() - unlockInfo.timestamp < UNLOCK_DURATION,
    );
  } catch (error) {
    console.error("Error checking unlock status:", error);
    return false;
  }
};

const markFileAsUnlocked = (docId: string, scope?: string): void => {
  try {
    const unlockedData = localStorage.getItem(storageKey(UNLOCKED_FILES_KEY, scope));
    const unlockedDocs = unlockedData ? JSON.parse(unlockedData) : {};
    unlockedDocs[docId] = { timestamp: Date.now() };
    localStorage.setItem(storageKey(UNLOCKED_FILES_KEY, scope), JSON.stringify(unlockedDocs));
  } catch (error) {
    console.error("Error marking document as unlocked:", error);
  }
};

const cleanupExpiredUnlocks = (scope?: string): void => {
  try {
    const unlockedData = localStorage.getItem(storageKey(UNLOCKED_FILES_KEY, scope));
    if (!unlockedData) return;

    const unlockedDocs = JSON.parse(unlockedData);
    const now = Date.now();
    let hasChanges = false;
    Object.keys(unlockedDocs).forEach((docId) => {
      if (now - unlockedDocs[docId].timestamp > UNLOCK_DURATION) {
        delete unlockedDocs[docId];
        hasChanges = true;
      }
    });

    if (hasChanges) {
      localStorage.setItem(storageKey(UNLOCKED_FILES_KEY, scope), JSON.stringify(unlockedDocs));
    }
  } catch (error) {
    console.error("Error cleaning up expired unlocks:", error);
  }
};

interface LibraryExplorerProps {
  onSelectFile: (doc: LibraryFile) => void;
  onEditFile: (doc: LibraryFile) => void;
  onCreateNew: (folderPath?: string) => void;
  refreshTrigger?: number;
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  currentOpenFileId?: string;
  onCloseFile?: () => void;
  onSwitchLibrary: () => void;
}

interface FolderTreeNode {
  path: string;
  name: string;
  folders: FolderTreeNode[];
  documents: LibraryFile[];
}

function createFolderTree(
  folderPaths: string[],
  documents: LibraryFile[],
): FolderTreeNode {
  const root: FolderTreeNode = {
    path: "",
    name: "知识库",
    folders: [],
    documents: [],
  };
  const nodes = new Map<string, FolderTreeNode>(
    [["", root]],
  );

  const ensureFolder = (folderPath: string): FolderTreeNode => {
    if (!folderPath) return root;
    const existing = nodes.get(folderPath);
    if (existing) return existing;

    let parent = root;
    let currentPath = "";
    folderPath.split("/").forEach((segment) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const nodeKey = currentPath;
      let current = nodes.get(nodeKey);
      if (!current) {
        current = {
          path: currentPath,
          name: segment,
          folders: [],
          documents: [],
        };
        nodes.set(nodeKey, current);
        parent.folders.push(current);
      }
      parent = current;
    });
    return parent;
  };

  folderPaths.forEach((folderPath) => ensureFolder(folderPath));
  documents.forEach((document) =>
    ensureFolder(document.folderPath).documents.push(document),
  );

  return root;
}

function fileName(document: LibraryFile): string {
  return document.path.split("/").at(-1) || document.title;
}

type MenuTarget =
  | { kind: "file"; document: LibraryFile }
  | { kind: "folder"; folder: FolderTreeNode };

export function LibraryExplorer({
  onSelectFile,
  onEditFile,
  onCreateNew,
  refreshTrigger,
  isCollapsed = false,
  onCollapseChange,
  currentOpenFileId,
  onCloseFile,
  onSwitchLibrary,
}: LibraryExplorerProps) {
  const repository = useLibraryRepository();
  const storageScope = repository.storageKey;
  const { mode } = useTheme();
  const [documents, setDocuments] = useState<LibraryFile[]>([]);
  const [folderPaths, setFolderPaths] = useState<string[]>([]);
  const [recentDocumentIds, setRecentDocumentIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(
        localStorage.getItem(storageKey(RECENT_FILES_KEY, storageScope)) || "[]",
      );
      return Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set([""]),
  );
  const [loading, setLoading] = useState(true);
  const [loadedRefreshTrigger, setLoadedRefreshTrigger] = useState<number>();
  const fetchRequestRef = useRef(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [pendingFile, setPendingFile] =
    useState<LibraryFile | null>(null);
  const [pendingAction, setPendingAction] = useState<"preview" | "edit" | null>(
    null,
  );
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: MenuTarget;
  } | null>(null);
  const contextMenuOriginRef = useRef<HTMLElement | null>(null);
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
    contextMenuOriginRef.current?.focus({ preventScroll: true });
  }, []);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [editingFolderPath, setEditingFolderPath] = useState<string | null>(
    null,
  );
  const [editingFolderName, setEditingFolderName] = useState("");
  const folderNameInputRef = useRef<HTMLInputElement>(null);

  const handleCollapseToggle = () => onCollapseChange?.(!isCollapsed);

  const fetchDocuments = useCallback(async () => {
    const request = ++fetchRequestRef.current;
    try {
      const [nextDocuments, nextFolders] = await Promise.all([
        repository.list(),
        repository.listFolders(),
      ]);
      if (request !== fetchRequestRef.current) return;
      setDocuments(nextDocuments);
      setLoadedRefreshTrigger(refreshTrigger);
      setFolderPaths(nextFolders);
      setSelectedFolder((current) =>
        current && nextFolders.includes(current) ? current : "",
      );
      setExpandedFolders((current) => {
        const next = new Set<string>();
        current.forEach((folderPath) => {
          if (!folderPath || nextFolders.includes(folderPath)) {
            next.add(folderPath);
          }
        });
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      if (request === fetchRequestRef.current) setLoading(false);
    }
  }, [repository, refreshTrigger]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments, refreshTrigger]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchDocuments();
      }
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const timer = window.setInterval(refreshWhenVisible, 5000);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(timer);
    };
  }, [fetchDocuments]);

  useEffect(() => {
    cleanupExpiredUnlocks(storageScope);
  }, [storageScope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey(RECENT_FILES_KEY, storageScope), JSON.stringify(recentDocumentIds));
    } catch (error) {
      console.error("Failed to persist recent documents:", error);
    }
  }, [recentDocumentIds, storageScope]);

  useEffect(() => {
    if (loading || !currentOpenFileId) return;
    const openDocument = documents.find(
      (document) => document.id === currentOpenFileId,
    );
    if (!openDocument) return;
    setRecentDocumentIds((current) => {
      if (current[0] === openDocument.id) return current;
      return [
        openDocument.id,
        ...current.filter((id) => id !== openDocument.id),
      ].slice(0, RECENT_FILES_LIMIT);
    });
  }, [currentOpenFileId, documents, loading]);

  useEffect(() => {
    if (!documents.length || !currentOpenFileId || !onCloseFile) return;
    const openDocument = documents.find(
      (document) => document.id === currentOpenFileId,
    );
    if (
      openDocument?.frontMatter?.password &&
      !isFileUnlocked(openDocument.id, storageScope)
    ) {
      const timer = setTimeout(onCloseFile, 100);
      return () => clearTimeout(timer);
    }
  }, [currentOpenFileId, documents, onCloseFile, storageScope]);

  useEffect(() => {
    if (loading || !currentOpenFileId || !onCloseFile) return;
    // A newly saved document may not exist in the previous list snapshot.
    if (loadedRefreshTrigger !== refreshTrigger) return;
    if (documents.some((document) => document.id === currentOpenFileId)) {
      return;
    }
    const timer = setTimeout(onCloseFile, 0);
    return () => clearTimeout(timer);
  }, [currentOpenFileId, documents, loading, loadedRefreshTrigger, onCloseFile, refreshTrigger]);

  const matchingDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    return new Fuse(documents, {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "path", weight: 0.5 },
        { name: "frontMatter.excerpt", weight: 0.2 },
        { name: "frontMatter.tags", weight: 0.3 },
        { name: "frontMatter.author", weight: 0.4 },
      ],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 1,
    })
      .search(searchQuery)
      .map((result) => result.item);
  }, [documents, searchQuery]);

  const tree = useMemo(
    () => createFolderTree(folderPaths, matchingDocuments),
    [folderPaths, matchingDocuments],
  );

  const recentDocuments = useMemo(() => {
    const byId = new Map(documents.map((doc) => [doc.id, doc]));
    return recentDocumentIds
      .map((id) => byId.get(id))
      .filter((doc): doc is LibraryFile => Boolean(doc));
  }, [documents, recentDocumentIds]);

  const expandedForRender = useMemo(() => {
    if (!searchQuery.trim()) return expandedFolders;
    const expanded = new Set<string>();
    matchingDocuments.forEach((document) => {
      expanded.add("");
      let currentPath = "";
      document.folderPath
        .split("/")
        .filter(Boolean)
        .forEach((segment) => {
          currentPath = currentPath ? `${currentPath}/${segment}` : segment;
          expanded.add(currentPath);
        });
    });
    return expanded;
  }, [expandedFolders, matchingDocuments, searchQuery]);

  const handleDelete = async (document: LibraryFile) => {
    if (!confirm("确定要删除这个文件吗？")) return;
    try {
      await repository.delete(document.id, document.path);
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
      window.alert(error instanceof Error ? error.message : "文件删除失败");
    }
  };

  const performFileSelect = (document: LibraryFile) => {
    if (document.frontMatter?.password && !isFileUnlocked(document.id, storageScope)) {
      setPendingFile(document);
      setPendingAction("preview");
      setShowPasswordModal(true);
      return;
    }
    recordRecentDocument(document);
    onSelectFile(document);
  };

  const recordRecentDocument = (document: LibraryFile) => {
    setRecentDocumentIds((current) => {
      return [
        document.id,
        ...current.filter((id) => id !== document.id),
      ].slice(0, RECENT_FILES_LIMIT);
    });
  };

  const handleEditFile = (document: LibraryFile) => {
    if (document.frontMatter?.password && !isFileUnlocked(document.id, storageScope)) {
      setPendingFile(document);
      setPendingAction("edit");
      setShowPasswordModal(true);
      return;
    }
    recordRecentDocument(document);
    onEditFile(document);
  };

  const handlePasswordConfirm = (password: string): boolean => {
    if (
      !pendingFile ||
      pendingFile.frontMatter?.password !== password
    ) {
      return false;
    }
    markFileAsUnlocked(pendingFile.id, storageScope);
    recordRecentDocument(pendingFile);
    if (pendingAction === "preview") onSelectFile(pendingFile);
    if (pendingAction === "edit") onEditFile(pendingFile);
    setPendingFile(null);
    setPendingAction(null);
    return true;
  };

  const toggleFolder = (folderKey: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderKey)) next.delete(folderKey);
      else next.add(folderKey);
      return next;
    });
  };

  const handleCreateFolder = async (parentPath: string) => {
    if (!repository.createFolder) return;

    const name = window.prompt("请输入新文件夹名称");
    if (!name?.trim()) return;
    const folderName = name.trim();
    if (folderName.includes("/") || folderName.includes("\\")) {
      window.alert("文件夹名称不能包含路径分隔符");
      return;
    }

    const folderPath = [parentPath, folderName].filter(Boolean).join("/");
    try {
      await repository.createFolder(folderPath);
      setSelectedFolder(folderPath);
      setExpandedFolders((current) => {
        const next = new Set(current);
        next.add(parentPath);
        return next;
      });
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to create folder:", error);
      window.alert(error instanceof Error ? error.message : "文件夹创建失败");
    }
  };

  const handleDeleteFolder = async (folder: FolderTreeNode) => {
    if (!repository.deleteFolder || !folder.path) return;
    if (!confirm(`确定要删除文件夹“${folder.name}”及其中的所有文件吗？内容将移入回收目录。`)) return;
    try {
      await repository.deleteFolder(folder.path);
      await fetchDocuments();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "文件夹删除失败");
    }
  };

  const openContextMenu = (event: React.MouseEvent<HTMLElement>, target: MenuTarget) => {
    event.preventDefault();
    event.stopPropagation();
    contextMenuOriginRef.current = event.currentTarget;
    if (target.kind === "folder") setSelectedFolder(target.folder.path);
    const bounds = event.currentTarget.getBoundingClientRect();
    setContextMenu({
      x: event.clientX || bounds.left,
      y: event.clientY || bounds.bottom,
      target,
    });
  };

  const startRenameFolder = (folder: FolderTreeNode) => {
    if (!repository.renameFolder || !folder.path) return;
    setEditingFolderPath(folder.path);
    setEditingFolderName(folder.name);
    requestAnimationFrame(() => {
      folderNameInputRef.current?.focus();
      folderNameInputRef.current?.select();
    });
  };

  const commitRenameFolder = async (folderPath: string) => {
    if (!repository.renameFolder) {
      setEditingFolderPath(null);
      return;
    }
    const nextName = editingFolderName.trim();
    if (!nextName) {
      setEditingFolderPath(null);
      return;
    }
    if (nextName.includes("/") || nextName.includes("\\")) {
      window.alert("文件夹名称不能包含路径分隔符");
      return;
    }
    if (nextName === (folderPath.split("/").at(-1) || "")) {
      setEditingFolderPath(null);
      return;
    }
    try {
      await repository.renameFolder(folderPath, nextName);
      setEditingFolderPath(null);
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to rename folder:", error);
      window.alert(error instanceof Error ? error.message : "文件夹重命名失败");
    }
  };

  const handleRenameFolderKeyDown = (
    folderPath: string,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRenameFolder(folderPath);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setEditingFolderPath(null);
    }
  };

  const handleDocumentDragStart = (
    document: LibraryFile,
    event: React.DragEvent,
  ) => {
    event.dataTransfer.setData("text/xylo-document", document.path);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleFolderDragOver = (
    folderPath: string,
    event: React.DragEvent,
  ) => {
    if (!repository.moveFile) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderPath);
  };

  const handleFolderDragLeave = (
    folderPath: string,
    event: React.DragEvent,
  ) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragOverFolder((current) =>
      current === folderPath ? null : current,
    );
  };

  const handleFolderDrop = async (
    folderPath: string,
    event: React.DragEvent,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverFolder(null);
    if (!repository.moveFile) return;

    const documentPath = event.dataTransfer.getData("text/xylo-document");
    if (!documentPath) return;
    try {
      await repository.moveFile(documentPath, folderPath);
      setExpandedFolders((current) => {
        const next = new Set(current);
        next.add(folderPath);
        return next;
      });
      await fetchDocuments();
    } catch (error) {
      console.error("Failed to move document:", error);
      window.alert(error instanceof Error ? error.message : "文件移动失败");
    }
  };

  const hasTreeEntries = tree.folders.length > 0 || tree.documents.length > 0;
  const menuActions: FileMenuAction[] = [];
  if (contextMenu?.target.kind === "file") {
    const document = contextMenu.target.document;
    menuActions.push(
      { label: "编辑", icon: PencilLine, disabled: !getFileStrategy(document).isEditable, onSelect: () => handleEditFile(document) },
      { label: "删除", icon: Trash2, destructive: true, onSelect: () => void handleDelete(document) },
    );
  } else if (contextMenu?.target.kind === "folder") {
    const folder = contextMenu.target.folder;
    menuActions.push(
      { label: "新建 Markdown 文档", icon: FilePlus2, onSelect: () => {
        setExpandedFolders((current) => new Set(current).add(folder.path));
        onCreateNew(folder.path || undefined);
      } },
      { label: "新建子文件夹", icon: FolderPlus, disabled: !repository.createFolder, onSelect: () => void handleCreateFolder(folder.path) },
    );
    if (folder.path) {
      menuActions.push(
        { label: "重命名", icon: PencilLine, disabled: !repository.renameFolder, onSelect: () => startRenameFolder(folder) },
        { label: "删除", icon: Trash2, disabled: !repository.deleteFolder, destructive: true, onSelect: () => void handleDeleteFolder(folder) },
      );
    }
  }

  const renderFile = (document: LibraryFile, depth: number) => {
    const isActive = currentOpenFileId === document.id;
    const strategy = getFileStrategy(document);
    const FileIcon = strategy.icon;
    const isUnlocked = isFileUnlocked(document.id, storageScope);
    return (
      <div
        key={document.id}
        role="treeitem"
        aria-selected={isActive}
        tabIndex={0}
        aria-label={fileName(document)}
        draggable={Boolean(repository.moveFile)}
        onDragStart={(event) => handleDocumentDragStart(document, event)}
        onClick={() => performFileSelect(document)}
        onContextMenu={(event) => openContextMenu(event, { kind: "file", document })}
        onKeyDown={(event) => {
          if (event.key === "Enter") performFileSelect(document);
        }}
        className="tech-tree-row tech-file-row group"
        style={{ paddingLeft: `${Math.min(depth, 6) * 16 + 8}px` }}
        title={document.path}
      >
        <span className="tree-chevron-slot" aria-hidden="true" />
        <span className="tree-icon-slot file-type-icon" data-type={strategy.type} aria-hidden="true">
          <FileIcon size={16} strokeWidth={1.7} />
        </span>
        <span className="min-w-0 flex-1 truncate">{fileName(document)}</span>
        {document.frontMatter?.password && (
          <span
            className="shrink-0 text-xs"
            title={isUnlocked ? "已解锁" : "需要密码"}
          >
            {isUnlocked ? <LockKeyholeOpen size={12} /> : <LockKeyhole size={12} />}
          </span>
        )}
      </div>
    );
  };

  const renderFolder = (
    folder: FolderTreeNode,
    depth: number,
  ): React.ReactNode => {
    const folderKey = folder.path;
    const isExpanded = expandedForRender.has(folderKey);
    const hasChildren = folder.folders.length > 0 || folder.documents.length > 0;
    return (
      <div key={folderKey} role="group">
        <div
          role="treeitem"
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-selected={selectedFolder === folder.path}
          aria-label={folder.name}
          tabIndex={0}
          onDragOver={(event) => handleFolderDragOver(folder.path, event)}
          onDragLeave={(event) => handleFolderDragLeave(folder.path, event)}
          onDrop={(event) => void handleFolderDrop(folder.path, event)}
          onContextMenu={(event) => openContextMenu(event, { kind: "folder", folder })}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedFolder(folder.path);
              if (hasChildren) toggleFolder(folderKey);
            }
          }}
          onClick={() => {
            setSelectedFolder(folder.path);
            if (hasChildren) toggleFolder(folderKey);
          }}
          className="tech-tree-row tech-folder-row group"
          data-drop-target={dragOverFolder === folder.path}
          style={{ paddingLeft: `${Math.min(depth, 6) * 16 + 8}px` }}
          title={folder.path || repository.name || "知识库"}
        >
          <span
            className="tree-chevron-slot"
            aria-hidden="true"
          >
            {hasChildren && <ChevronRight size={13} strokeWidth={1.8} className="tree-chevron" data-expanded={isExpanded} />}
          </span>
          <span className="tree-icon-slot tree-folder-icon" aria-hidden="true">
            {!folder.path ? <Database size={17} strokeWidth={1.7} /> : isExpanded ? <Layers3 size={17} strokeWidth={1.7} /> : <Layers2 size={17} strokeWidth={1.7} />}
          </span>
          {editingFolderPath === folder.path ? (
            <input
              ref={folderNameInputRef}
              type="text"
              value={editingFolderName}
              onChange={(event) => setEditingFolderName(event.target.value)}
              onKeyDown={(event) =>
                handleRenameFolderKeyDown(folder.path, event)
              }
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onBlur={() => setEditingFolderPath(null)}
              className={`min-w-0 flex-1 rounded border px-1.5 py-0.5 text-sm font-medium focus:outline-none focus:ring-2 ${
                mode === "dark"
                  ? "border-slate-600 bg-slate-800 text-white focus:border-slate-500 focus:ring-slate-500/40"
                  : "border-gray-300 bg-white text-gray-900 focus:border-gray-400 focus:ring-gray-400/40"
              }`}
              aria-label={`重命名文件夹${folder.name}`}
            />
          ) : (
            <span className="min-w-0 flex-1 truncate font-medium">
              {folder.name}
            </span>
          )}
        </div>
        {isExpanded && (
          <div className="tech-tree-children" style={{ "--tree-guide-x": `${Math.min(depth, 6) * 16 + 17}px` } as React.CSSProperties}>
            {folder.folders.map((child) => renderFolder(child, depth + 1))}
            {folder.documents.map((document) =>
              renderFile(document, depth + 1),
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className={`h-8 w-8 animate-spin rounded-full border-4 border-t-transparent ${
              mode === "dark" ? "border-gray-600" : "border-gray-400"
            }`}
          />
          <div className={mode === "dark" ? "text-gray-400" : "text-gray-500"}>
            加载中...
          </div>
        </div>
      </div>
    );
  }

  if (isCollapsed) {
    return (
      <div
        className="tech-sidebar relative flex h-full flex-col items-center"
      >
        <div className="flex w-full flex-col items-center gap-3 py-4">
          <span title="Xylo 本地知识库"><BrandIcon /></span>
          <IconButton
            onClick={handleCollapseToggle}
            title="展开"
            size="sm"
          >
            <PanelLeftOpen strokeWidth={1.75} />
          </IconButton>
        </div>
        <div className="flex w-full flex-col items-center gap-2">
          <IconButton onClick={onSwitchLibrary} title="切换知识库" size="sm"><FolderOpen strokeWidth={1.75} /></IconButton>
          <ThemeToggle size="sm" />
          <VisualEffectsToggle />
        </div>
      </div>
    );
  }

  return (
    <div
      className="tech-sidebar relative flex h-full flex-col"
    >
      <div
        className="tech-sidebar-header shrink-0 p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="tech-brand-mark" title="Xylo 本地知识库"><BrandIcon /></span>
            <h2 className="truncate text-sm font-semibold" title={repository.name}>{repository.name || "本地知识库"}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton onClick={onSwitchLibrary} title="切换知识库" size="sm">
              <FolderOpen strokeWidth={1.75} />
            </IconButton>
            <VisualEffectsToggle />
            <ThemeToggle size="sm" compact />
            <IconButton
              onClick={handleCollapseToggle}
              title="折叠"
              size="sm"
            >
              <PanelLeftClose strokeWidth={1.75} />
            </IconButton>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              placeholder="搜索文件..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="搜索文件"
              className="tech-search w-full rounded-md border py-2 pl-9 pr-8 text-sm outline-none"
            />
            <Search size={15} strokeWidth={1.75} className="tech-muted absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            {searchQuery && (
              <button type="button" className="tech-search-clear" onClick={() => setSearchQuery("")} title="清空搜索" aria-label="清空搜索">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {recentDocuments.length > 0 && (
          <div
            className="tech-recent mb-2 px-3 pb-3 pt-1"
          >
            <div
              className="tech-muted mb-2 flex items-center gap-2 text-xs font-medium"
            >
              <Clock3 size={12} strokeWidth={1.75} aria-hidden="true" />
              最近打开
            </div>
            <div className="space-y-0.5">
              {recentDocuments.map((document) => {
                const strategy = getFileStrategy(document);
                const FileIcon = strategy.icon;
                return (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => performFileSelect(document)}
                  onContextMenu={(event) => openContextMenu(event, { kind: "file", document })}
                  className="tech-recent-row flex w-full min-w-0 items-center gap-2 rounded px-2 py-1.5 text-left text-sm"
                  title={document.path}
                >
                  <span className="tree-icon-slot file-type-icon" data-type={strategy.type} aria-hidden="true">
                    <FileIcon size={15} strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {fileName(document)}
                  </span>
                </button>
                );
              })}
            </div>
          </div>
        )}
        <div role="tree" aria-label="知识库文件树">
          {!hasTreeEntries && searchQuery ? (
            <div
              className={`p-8 text-center text-xs ${
                mode === "dark" ? "text-gray-500" : "text-gray-400"
              }`}
            >
              {searchQuery
                ? "未找到匹配的文件"
                : "还没有文件，点击上方按钮创建第一个文档"}
            </div>
          ) : (
            renderFolder(tree, 0)
          )}
        </div>
      </div>

      {contextMenu && !isCollapsed && (
        <FileContextMenu
          key={contextMenu.target.kind === "file" ? `file:${contextMenu.target.document.path}` : `folder:${contextMenu.target.folder.path}`}
          x={contextMenu.x}
          y={contextMenu.y}
          actions={menuActions}
          onClose={closeContextMenu}
        />
      )}

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingFile(null);
          setPendingAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        title={
          pendingAction === "preview"
            ? "验证密码以预览文档"
            : "验证密码以编辑文档"
        }
        message={
          pendingAction === "preview"
            ? "请输入密码以预览此文档"
            : "请输入密码以编辑此文档"
        }
      />
    </div>
  );
}
