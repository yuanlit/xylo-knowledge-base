"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import { useTheme } from "@/contexts/theme-context";
import type { FileViewerProps } from "@/strategies/file-strategy";

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function BinaryViewer({ document }: FileViewerProps) {
  const repository = useLibraryRepository();
  const { mode } = useTheme();
  const [fileUrl, setFileUrl] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [mimeType, setMimeType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileName = document.path.split("/").at(-1) || document.title;

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    repository
      .readFile(document.path)
      .then((file) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(file);
        setFileUrl(objectUrl);
        setFileSize(file.size);
        setMimeType(file.type || "未知");
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

  const infoItems: Array<{ label: string; value: string }> = [
    { label: "文件名", value: fileName },
    { label: "路径", value: document.path },
    { label: "大小", value: formatFileSize(fileSize) },
    { label: "类型", value: mimeType },
  ];

  return (
    <div className="flex h-full w-full flex-col bg-white dark:bg-slate-950">
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
            二进制文件
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={fileUrl}
            download={fileName}
            className="tech-icon-button h-8 w-8"
            title="下载文件"
            aria-label="下载文件"
          >
            <Download size={16} strokeWidth={1.75} />
          </a>
          <button
            type="button"
            onClick={() => window.open(fileUrl, "_blank")}
            className="tech-icon-button h-8 w-8"
            title="在浏览器中打开"
            aria-label="在浏览器中打开"
          >
            <ExternalLink size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div
          className={`rounded-lg border p-5 ${
            mode === "dark"
              ? "border-slate-800 bg-slate-900/60"
              : "border-gray-200 bg-gray-50/80"
          }`}
        >
          <h2
            className={`mb-4 text-sm font-semibold ${
              mode === "dark" ? "text-gray-100" : "text-gray-900"
            }`}
          >
            文件信息
          </h2>
          <dl className="space-y-3">
            {infoItems.map((item) => (
              <div
                key={item.label}
                className="flex flex-wrap items-start justify-between gap-2"
              >
                <dt
                  className={`shrink-0 text-sm ${
                    mode === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {item.label}
                </dt>
                <dd
                  className={`min-w-0 break-all text-right text-sm font-medium ${
                    mode === "dark" ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
