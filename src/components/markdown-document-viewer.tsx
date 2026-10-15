"use client";

import { MarkdownEditor } from "@/components/markdown-editor";
import type {
  FileCreateViewerProps,
  FileViewerProps,
} from "@/strategies/file-strategy";

export function MarkdownDocumentViewer({
  document,
  onSave,
  onClose,
  isNew,
  isEditMode,
  onExitEditMode,
  viewerRef,
}: FileViewerProps) {
  return (
    <MarkdownEditor
      ref={viewerRef}
      document={document}
      onSave={onSave}
      onClose={onClose}
      isNew={isNew}
      isEditMode={isEditMode}
      onExitEditMode={onExitEditMode}
    />
  );
}

export function MarkdownCreateViewer({
  onSave,
  onClose,
  isNew,
  isEditMode,
  onExitEditMode,
  viewerRef,
}: FileCreateViewerProps) {
  return (
    <MarkdownEditor
      ref={viewerRef}
      document={null}
      onSave={onSave}
      onClose={onClose}
      isNew={isNew}
      isEditMode={isEditMode}
      onExitEditMode={onExitEditMode}
    />
  );
}
