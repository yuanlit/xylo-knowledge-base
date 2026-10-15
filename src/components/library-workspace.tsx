"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/contexts/theme-context";
import { LibraryExplorer } from "@/components/library-explorer";
import { PointerEffectsProvider } from "@/components/pointer-effects";
import { MarkdownEditorRef } from "@/components/markdown-editor";
import {
  getFileStrategy,
  markdownStrategy,
} from "@/strategies/file-strategy";
import type { DocumentFrontMatter, LibraryFile } from "@/types/library-file";

interface LibraryWorkspaceProps {
  selectedFile: LibraryFile | null;
  isCreatingNew: boolean;
  isEditMode: boolean;
  refreshTrigger: number;
  onSelectFile: (doc: LibraryFile) => void;
  onEditFile: (doc: LibraryFile) => void;
  onCreateNew: (folderPath?: string) => void;
  onSaveDocument: (title: string, content: string, frontMatter: DocumentFrontMatter) => Promise<void>;
  onCloseEditor: () => void;
  onExitEditMode: () => void;
  onSwitchLibrary: () => void;
}

const LIBRARY_EXPLORER_COLLAPSED_KEY = 'document-list-collapsed';

export function LibraryWorkspace({
  selectedFile,
  isCreatingNew,
  isEditMode,
  refreshTrigger,
  onSelectFile,
  onEditFile,
  onCreateNew,
  onSaveDocument,
  onCloseEditor,
  onExitEditMode,
  onSwitchLibrary,
}: LibraryWorkspaceProps) {
  const { mode } = useTheme();
  const editorRef = useRef<MarkdownEditorRef>(null);

  // 使用默认值，避免 hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 检查未保存的更改并提示
  const checkUnsavedChanges = (): boolean => {
    if (editorRef.current?.hasUnsavedChanges()) {
      return confirm('您有未保存的修改，确定要离开吗？修改的内容将会丢失。');
    }
    return true;
  };

  // 包装 onSelectFile
  const handleSelectFile = (doc: LibraryFile) => {
    if (checkUnsavedChanges()) {
      onSelectFile(doc);
    }
  };

  // 编辑前检查未保存的更改
  const handleEditFile = (doc: LibraryFile) => {
    if (checkUnsavedChanges()) {
      onEditFile(doc);
    }
  };

  // 包装 onCreateNew
  const handleCreateNew = (folderPath?: string) => {
    if (checkUnsavedChanges()) {
      onCreateNew(folderPath);
    }
  };

  const handleSwitchLibrary = () => {
    if (editorRef.current?.hasPendingWrites()) {
      alert("文档或图片正在保存，请完成后再切换知识库");
      return;
    }
    if (checkUnsavedChanges()) onSwitchLibrary();
  };

  // 在客户端挂载后从 localStorage 读取折叠状态
  useEffect(() => {
    const saved = localStorage.getItem(LIBRARY_EXPLORER_COLLAPSED_KEY);
    if (saved !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(saved === 'true');
    }
  }, []);

  // 保存折叠状态到 localStorage
  const handleCollapseChange = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LIBRARY_EXPLORER_COLLAPSED_KEY, String(collapsed));
    }
  };

  const bgColor = mode === 'dark' ? '#141518' : '#ffffff';
  const selectedStrategy = selectedFile
    ? getFileStrategy(selectedFile)
    : null;
  const Viewer = selectedStrategy?.viewer;
  const CreateViewer = isCreatingNew ? markdownStrategy.createViewer : null;

  return (
    <PointerEffectsProvider>
    <div
      className="xylo-workspace flex h-full w-full transition-colors duration-300"
      style={{ height: '100vh', backgroundColor: bgColor }}
    >
      {/* 文档列表侧边栏 */}
      <div
        className="flex-shrink-0 h-full relative transition-all duration-300 overflow-hidden"
        style={{ width: isCollapsed ? '60px' : '288px' }}
      >
        <div className="relative h-full">
          <LibraryExplorer
            onSelectFile={handleSelectFile}
            onEditFile={handleEditFile}
            onCreateNew={handleCreateNew}
            refreshTrigger={refreshTrigger}
            isCollapsed={isCollapsed}
            onCollapseChange={handleCollapseChange}
            currentOpenFileId={selectedFile?.id}
            onCloseFile={onCloseEditor}
            onSwitchLibrary={handleSwitchLibrary}
          />
        </div>
      </div>

      {/* 编辑器区域 - 占满所有剩余空间 */}
      <div
        className="flex-1 flex flex-col relative overflow-hidden min-w-0 transition-colors duration-300"
        style={{ backgroundColor: bgColor }}
      >
        {CreateViewer ? (
          <>
            <div
              className="absolute inset-0 transition-colors duration-300"
              style={{ backgroundColor: bgColor }}
            ></div>
            <div
              className="relative h-full w-full flex flex-col min-w-0 transition-colors duration-300"
              style={{ backgroundColor: bgColor }}
            >
              <CreateViewer
                onSave={onSaveDocument}
                onClose={onCloseEditor}
                isNew={isCreatingNew}
                isEditMode={isEditMode || isCreatingNew}
                onExitEditMode={onExitEditMode}
                viewerRef={editorRef}
              />
            </div>
          </>
        ) : selectedFile && Viewer ? (
          selectedStrategy?.isEditable ? (
            <>
              <div
                className="absolute inset-0 transition-colors duration-300"
                style={{ backgroundColor: bgColor }}
              ></div>
              <div
                className="relative h-full w-full flex flex-col min-w-0 transition-colors duration-300"
                style={{ backgroundColor: bgColor }}
              >
                <Viewer
                  document={selectedFile}
                  onSave={onSaveDocument}
                  onClose={onCloseEditor}
                  isNew={isCreatingNew}
                  isEditMode={isEditMode || isCreatingNew}
                  onExitEditMode={onExitEditMode}
                  viewerRef={editorRef}
                />
              </div>
            </>
          ) : (
            <Viewer
              document={selectedFile}
              onSave={onSaveDocument}
              onClose={onCloseEditor}
              isNew={isCreatingNew}
              isEditMode={isEditMode || isCreatingNew}
              onExitEditMode={onExitEditMode}
            />
          )
        ) : (
          null
        )}
      </div>
    </div>
    </PointerEffectsProvider>
  );
}
