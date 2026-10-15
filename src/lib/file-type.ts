import type { LibraryFileType } from "@/types/library-file";

const MARKDOWN_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".mdown",
  ".mkd",
]);

const HTML_EXTENSIONS = new Set([".html", ".htm"]);

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".bash",
  ".bat",
  ".c",
  ".cfg",
  ".cmd",
  ".conf",
  ".cpp",
  ".cs",
  ".cjs",
  ".css",
  ".csv",
  ".cts",
  ".dockerignore",
  ".editorconfig",
  ".env",
  ".eslintignore",
  ".eslintrc",
  ".eslintrc.json",
  ".fish",
  ".gitattributes",
  ".gitignore",
  ".go",
  ".gql",
  ".graphql",
  ".h",
  ".hpp",
  ".ini",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".kt",
  ".less",
  ".log",
  ".mjs",
  ".mts",
  ".npmignore",
  ".npmrc",
  ".nvmrc",
  ".node-version",
  ".php",
  ".prettierrc",
  ".proto",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sass",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".swift",
  ".text",
  ".toml",
  ".tool-versions",
  ".ts",
  ".tsv",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yarnrc",
  ".yaml",
  ".yml",
  ".zsh",
]);

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".htm": "text/html; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".markdown": "text/markdown; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

export function extensionFromPath(value: string): string {
  const fileName = value.split("/").pop() || value;
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

export function detectFileType(extension: string): LibraryFileType {
  const normalized = extension.toLowerCase();
  const withDot = normalized.startsWith(".") ? normalized : `.${normalized}`;

  if (MARKDOWN_EXTENSIONS.has(withDot)) return "markdown";
  if (HTML_EXTENSIONS.has(withDot)) return "html";
  if (IMAGE_EXTENSIONS.has(withDot)) return "image";
  if (TEXT_EXTENSIONS.has(withDot) || !withDot || withDot === ".") return "text";
  return "binary";
}

export function contentTypeForFile(
  extension: string,
  type: LibraryFileType,
): string {
  const normalized = extension.toLowerCase();
  const withDot = normalized.startsWith(".") ? normalized : `.${normalized}`;

  if (type === "image" || type === "markdown" || type === "html" || type === "text") {
    return CONTENT_TYPES[withDot] || "text/plain; charset=utf-8";
  }
  return CONTENT_TYPES[withDot] || "application/octet-stream";
}
