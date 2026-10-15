import type { ComponentType, Ref } from "react";
import { FileCode2, FileText, Image, FileTerminal, FileBox, type LucideIcon } from "lucide-react";
import { BinaryViewer } from "@/components/binary-viewer";
import { HTMLViewer } from "@/components/html-viewer";
import { ImageViewer } from "@/components/image-viewer";
import {
  MarkdownCreateViewer,
  MarkdownDocumentViewer,
} from "@/components/markdown-document-viewer";
import { TextFileViewer } from "@/components/text-viewer";
import type { MarkdownEditorRef } from "@/components/markdown-editor";
import { extensionFromPath } from "@/lib/file-type";
import type {
  DocumentFrontMatter,
  LibraryFile,
  LibraryFileType,
} from "@/types/library-file";

export interface FileViewerProps {
  document: LibraryFile;
  onSave: (
    title: string,
    content: string,
    frontMatter: DocumentFrontMatter,
  ) => Promise<void>;
  onClose: () => void;
  isNew: boolean;
  isEditMode: boolean;
  onExitEditMode: () => void;
  viewerRef?: Ref<MarkdownEditorRef>;
}

export type FileCreateViewerProps = Omit<FileViewerProps, "document">;

export interface FileStrategy {
  type: LibraryFileType;
  icon: LucideIcon;
  isEditable: boolean;
  viewer: ComponentType<FileViewerProps>;
  createViewer?: ComponentType<FileCreateViewerProps>;
}

export const markdownStrategy: FileStrategy = {
  type: "markdown",
  icon: FileText,
  isEditable: true,
  viewer: MarkdownDocumentViewer,
  createViewer: MarkdownCreateViewer,
};

export const htmlStrategy: FileStrategy = {
  type: "html",
  icon: FileCode2,
  isEditable: false,
  viewer: HTMLViewer,
};

export const imageStrategy: FileStrategy = {
  type: "image",
  icon: Image,
  isEditable: false,
  viewer: ImageViewer,
};

export const textStrategy: FileStrategy = {
  type: "text",
  icon: FileTerminal,
  isEditable: false,
  viewer: TextFileViewer,
};

export const binaryStrategy: FileStrategy = {
  type: "binary",
  icon: FileBox,
  isEditable: false,
  viewer: BinaryViewer,
};

export function getFileStrategy(
  document: LibraryFile,
): FileStrategy {
  const extension = (
    document.extension || extensionFromPath(document.path)
  ).toLowerCase();

  if (document.type === "html") return htmlStrategy;
  if (document.type === "image") return imageStrategy;
  if (document.type === "text") return textStrategy;
  if (document.type === "markdown") {
    return extension === ".md" ? markdownStrategy : textStrategy;
  }
  return binaryStrategy;
}
