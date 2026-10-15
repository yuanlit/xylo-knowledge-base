import { SYSTEM_DIRECTORY } from "@/lib/library-paths";

const IMAGE_ASSET_PREFIX = `${SYSTEM_DIRECTORY}/assets/images/`;

const EXTENSIONS_BY_TYPE: Record<string, string> = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function createImageAssetName(file: File): Promise<string> {
  const sourceExtension = file.name.split(".").pop()?.toLowerCase();
  const extension = EXTENSIONS_BY_TYPE[file.type] || sourceExtension;
  if (!extension || !Object.values(EXTENSIONS_BY_TYPE).includes(extension)) {
    throw new Error(`不支持的图片格式：${file.type || file.name}`);
  }

  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hash}.${extension}`;
}

export function toImageMarkdownPath(fileName: string): string {
  return `${IMAGE_ASSET_PREFIX}${fileName}`;
}

export function getImageAssetName(source: string): string | null {
  const normalized = source.split(/[?#]/, 1)[0].replaceAll("\\", "/");
  for (const assetMarker of [IMAGE_ASSET_PREFIX, "assets/images/"]) {
    const markerIndex = normalized.indexOf(assetMarker);
    if (markerIndex === -1) continue;

    const prefix = normalized.slice(0, markerIndex);
    if (prefix && !/^\/{0,1}(?:\.\.?\/)*$/.test(prefix)) continue;

    const fileName = normalized.slice(markerIndex + assetMarker.length);
    if (/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileName)) return fileName;
  }
  return null;
}

export function imageAltText(file: File): string {
  return file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[[\]]/g, "")
    .trim() || "图片";
}
