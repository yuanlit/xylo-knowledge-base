"use client";

import { useEffect, useState } from "react";
import { LibraryWorkspace } from "@/components/library-workspace";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import { useTheme } from "@/contexts/theme-context";
import { showToast } from "@/lib/toast";
import { getFileStrategy } from "@/strategies/file-strategy";
import type {
  DocumentFrontMatter,
  LibraryFile,
} from "@/types/library-file";

interface KnowledgeBaseAppProps {
  searchParams: URLSearchParams;
  navigate: (url: string) => void;
  onSwitchLibrary: () => void;
}

export function KnowledgeBaseApp({
  searchParams,
  navigate,
  onSwitchLibrary,
}: KnowledgeBaseAppProps) {
  const repository = useLibraryRepository();
  const { mode } = useTheme();
  const [loadedDocument, setLoadedDocument] =
    useState<LibraryFile | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [documents, setDocuments] = useState<LibraryFile[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [pendingFolderPath, setPendingFolderPath] = useState("");

  const bgColor = mode === "dark" ? "#0f0f0f" : "#ffffff";
  const isEditMode =
    searchParams.get("edit") === "true" || searchParams.get("new") === "true";
  const routeDocumentId = searchParams.get("id");
  const isCreatingNew = searchParams.get("new") === "true";
  const newFolderPath = pendingFolderPath || searchParams.get("folder") || "";
  const listDocument = documents.find(
    (document) => document.id === routeDocumentId,
  );
  const listStrategy = listDocument
    ? getFileStrategy(listDocument)
    : null;
  const selectedFile =
    !isCreatingNew && routeDocumentId
      ? listDocument
        ? listStrategy?.isEditable
          ? loadedDocument?.id === routeDocumentId
            ? loadedDocument
            : null
          : listDocument
        : loadedDocument?.id === routeDocumentId
          ? loadedDocument
          : null
      : null;

  useEffect(() => {
    repository
      .list()
      .then((nextDocuments) => {
        setDocuments(nextDocuments);
        setDocumentsLoaded(true);
      })
      .catch((error) => console.error("Failed to load documents:", error));
  }, [repository, refreshTrigger]);

  useEffect(() => {
    if (
      !routeDocumentId ||
      isCreatingNew ||
      !documentsLoaded ||
      (listDocument && !listStrategy?.isEditable)
    ) {
      return;
    }

    repository
      .get(routeDocumentId)
      .then((document) => {
        if (!document) {
          navigate("/");
          return;
        }
        setLoadedDocument(document);
      })
      .catch((error) => {
        console.error("Failed to load document:", error);
        navigate("/");
      });
  }, [
    documentsLoaded,
    isCreatingNew,
    listDocument,
    listStrategy,
    navigate,
    repository,
    routeDocumentId,
  ]);

  const saveDocument = async (
    title: string,
    content: string,
    frontMatter: DocumentFrontMatter,
  ) => {
    try {
      const document =
        !isCreatingNew && selectedFile
          ? await repository.update(selectedFile.id, {
              title,
              content,
              frontMatter,
            })
          : await repository.create({
              title,
              content,
              frontMatter,
              folderPath: newFolderPath || undefined,
            });

      setLoadedDocument(document);
      setDocuments((current) => [
        document,
        ...current.filter((item) => item.id !== document.id),
      ]);
      setPendingFolderPath("");
      setRefreshTrigger((value) => value + 1);
      navigate(`/?id=${encodeURIComponent(document.id)}&edit=true`);
      showToast.success("文档保存成功");
    } catch (error) {
      const message = error instanceof Error ? error.message : "文档保存失败";
      showToast.error(message);
      throw error;
    }
  };

  return (
    <main
      className="h-screen w-screen overflow-hidden transition-colors duration-300"
      style={{ backgroundColor: bgColor }}
    >
      <LibraryWorkspace
        selectedFile={selectedFile}
        isCreatingNew={isCreatingNew}
        isEditMode={isEditMode}
        refreshTrigger={refreshTrigger}
        onSelectFile={(document) =>
          navigate(`/?id=${encodeURIComponent(document.id)}`)
        }
        onEditFile={(document) =>
          navigate(
            getFileStrategy(document).isEditable
              ? `/?id=${encodeURIComponent(document.id)}&edit=true`
              : `/?id=${encodeURIComponent(document.id)}`,
          )
        }
        onCreateNew={(folderPath) => {
          setPendingFolderPath(folderPath || "");
          navigate(
            `/?new=true${folderPath ? `&folder=${encodeURIComponent(folderPath)}` : ""}`,
          );
        }}
        onSaveDocument={saveDocument}
        onCloseEditor={() => navigate("/")}
        onExitEditMode={() => {
          if (selectedFile) {
            navigate(`/?id=${encodeURIComponent(selectedFile.id)}`);
          }
        }}
        onSwitchLibrary={onSwitchLibrary}
      />
    </main>
  );
}
