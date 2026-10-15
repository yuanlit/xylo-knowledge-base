"use client";

import { useEffect, useRef, useState } from "react";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import type { FileViewerProps } from "@/strategies/file-strategy";

export function HTMLViewer({ document }: FileViewerProps) {
  const repository = useLibraryRepository();
  const [htmlContent, setHtmlContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sandboxRef = useRef<HTMLIFrameElement>(null);
  const isExtension = typeof chrome !== "undefined" && Boolean(chrome.runtime?.id);

  useEffect(() => {
    const loadHTML = async () => {
      try {
        setLoading(true);
        setError(null);
        setHtmlContent(await repository.readHtml(document.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        setLoading(false);
      }
    };

    loadHTML();
  }, [document.id, repository]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (isExtension) {
    return (
      <iframe
        ref={sandboxRef}
        src={chrome.runtime.getURL("sandbox.html")}
        className="h-full w-full border-0"
        title={document.title}
        onLoad={() =>
          sandboxRef.current?.contentWindow?.postMessage(
            { type: "xylo:render-html", content: htmlContent },
            "*",
          )
        }
      />
    );
  }

  return (
    <iframe
      srcDoc={htmlContent}
      className="w-full h-full border-0"
      title={document.title}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
