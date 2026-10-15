"use client";

import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut, Scan, Download } from "lucide-react";
import {
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import { useTheme } from "@/contexts/theme-context";
import type { FileViewerProps } from "@/strategies/file-strategy";

const iconButtonClass =
  "tech-icon-button h-9 w-9";

export function ImageViewer({ document }: FileViewerProps) {
  const repository = useLibraryRepository();
  const { mode } = useTheme();
  const [sourceUrl, setSourceUrl] = useState("");
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
        setSourceUrl(objectUrl);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "图片加载失败");
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
    <TransformWrapper
      initialScale={1}
      minScale={0.1}
      maxScale={8}
      wheel={{ step: 0.1 }}
      doubleClick={{ disabled: true }}
      centerOnInit
      limitToBounds={false}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <div className="flex h-full w-full min-w-0 flex-col bg-white dark:bg-slate-950">
          <div
            className="tech-viewer-toolbar flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5"
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
                图片预览
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => zoomIn()}
                title="放大"
                aria-label="放大"
                className={iconButtonClass}
              >
                <ZoomIn size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => zoomOut()}
                title="缩小"
                aria-label="缩小"
                className={iconButtonClass}
              >
                <ZoomOut size={16} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={() => resetTransform()}
                title="重置缩放"
                aria-label="重置缩放"
                className={iconButtonClass}
              >
                <Scan size={16} strokeWidth={1.75} />
              </button>
              <a
                href={sourceUrl}
                download={fileName}
                title="下载图片"
                aria-label="下载图片"
                className={iconButtonClass}
              >
                <Download size={16} strokeWidth={1.75} />
              </a>
            </div>
          </div>
          <TransformComponent
            wrapperClass="h-full w-full flex-1 overflow-hidden"
            contentClass="flex h-full w-full items-center justify-center"
          >
            <img
              src={sourceUrl}
              alt={fileName}
              draggable={false}
              className="max-w-none select-none w-full"
            />
          </TransformComponent>
        </div>
      )}
    </TransformWrapper>
  );
}
