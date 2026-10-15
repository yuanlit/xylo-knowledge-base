"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import { useTheme } from "@/contexts/theme-context";
import type { FileViewerProps } from "@/strategies/file-strategy";

export function TextFileViewer({ document }: FileViewerProps) {
  const repository = useLibraryRepository();
  const { mode } = useTheme();
  const [text, setText] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileName = document.path.split("/").at(-1) || document.title;

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    repository
      .readFile(document.path)
      .then(async (file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file);
        setFileUrl(objectUrl);
        setText(await file.text());
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "文件读取失败");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [document.path, repository]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-500 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-w-0 flex-col bg-white dark:bg-slate-950">
      <div
        className="tech-viewer-toolbar flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`truncate text-sm font-medium ${
              mode === "dark" ? "text-gray-100" : "text-gray-900"
            }`}
          >
            {fileName}
          </span>
          <span
            className={`shrink-0 text-xs ${
              mode === "dark" ? "text-gray-400" : "text-gray-500"
            }`}
          >
            文本文件
          </span>
        </div>
        <a
          href={fileUrl}
          download={fileName}
          className="tech-icon-button h-8 w-8"
          title="下载文件"
          aria-label="下载文件"
        >
          <Download size={16} strokeWidth={1.75} />
        </a>
      </div>
      <pre
        className={`flex-1 overflow-auto whitespace-pre-wrap break-words p-6 text-sm leading-6 ${
          mode === "dark"
            ? "bg-slate-950 text-gray-200"
            : "bg-white text-gray-800"
        }`}
      >
        {text}
      </pre>
    </div>
  );
}
