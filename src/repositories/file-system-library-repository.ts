import { parse, stringify } from "yaml";
import type { LibraryRepository } from "@/repositories/library-repository";
import type {
  DocumentFrontMatter,
  LibraryFile,
  SaveMarkdownInput,
} from "@/types/library-file";
import {
  createImageAssetName,
  getImageAssetName,
  toImageMarkdownPath,
} from "@/lib/image-assets";
import {
  detectFileType,
  extensionFromPath,
} from "@/lib/file-type";
import { SYSTEM_DIRECTORY } from "@/lib/library-paths";

const LEGACY_DOCS_DIRECTORY = "docs";
const TRASH_DIRECTORY = "trash";
const LEGACY_TRASH_DIRECTORY = "garbage";
const ASSETS_DIRECTORY = "assets";
const IMAGES_DIRECTORY = "images";

interface ParsedMarkdown {
  frontMatter: DocumentFrontMatter;
  content: string;
}

function parseMarkdown(source: string): ParsedMarkdown {
  const normalized = source.replace(/^\uFEFF/, "");
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontMatter: {}, content: normalized };
  }

  try {
    const frontMatter = parse(match[1]) ?? {};
    if (typeof frontMatter === "object" && !Array.isArray(frontMatter)) {
      return { frontMatter, content: normalized.slice(match[0].length) };
    }
  } catch {
    // Keep invalid metadata in the body so loading and editing cannot discard it.
  }

  return { frontMatter: {}, content: normalized };
}

function serializeMarkdown(
  content: string,
  frontMatter: DocumentFrontMatter,
): string {
  return `---\n${stringify(frontMatter).trimEnd()}\n---\n${content}`;
}

function safeDocumentId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

async function writeFile(
  directory: FileSystemDirectoryHandle,
  name: string,
  content: string | File,
): Promise<void> {
  const handle = await directory.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

async function fileExists(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<boolean> {
  try {
    await directory.getFileHandle(name);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

function normalizeRelativePath(value: string): string {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("文档路径不合法");
  }
  if (segments.some((segment) => segment.toLowerCase() === SYSTEM_DIRECTORY)) {
    throw new Error("不能访问或修改知识库系统目录");
  }
  return segments.join("/");
}

function documentId(relativePath: string): string {
  return relativePath.replace(/\.(md|html|htm)$/i, "");
}

function documentFolder(relativePath: string): string {
  const slash = relativePath.lastIndexOf("/");
  return slash === -1 ? "" : relativePath.slice(0, slash);
}

async function isDirectoryInStack(
  directory: FileSystemDirectoryHandle,
  stack: FileSystemDirectoryHandle[],
): Promise<boolean> {
  for (const ancestor of stack) {
    if (await directory.isSameEntry(ancestor)) return true;
  }
  return false;
}

async function listDirectoryEntries(
  directory: FileSystemDirectoryHandle,
): Promise<[string, FileSystemHandle][]> {
  const entries: [string, FileSystemHandle][] = [];
  for await (const entry of directory.entries()) {
    entries.push(entry);
  }
  // 目录迭代顺序不保证稳定，按名称排序避免轮询刷新时文件树跳动
  return entries.sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

export class FileSystemLibraryRepository implements LibraryRepository {
  private readonly rootDirectory: FileSystemDirectoryHandle;
  readonly storageKey: string;
  readonly name: string;

  constructor(
    rootDirectory: FileSystemDirectoryHandle,
    id = rootDirectory.name,
    private readonly layout: "root" | "docs" = "root",
  ) {
    this.rootDirectory = rootDirectory;
    this.storageKey = `xylo-library:${id}${layout === "root" ? ":root" : ""}`;
    this.name = rootDirectory.name;
  }

  async list(): Promise<LibraryFile[]> {
    const documents: LibraryFile[] = [];
    await this.collectFiles(
      await this.getContentDirectory(),
      "",
      documents,
      [],
    );

    return documents;
  }

  async listFolders(): Promise<string[]> {
    const folders: string[] = [];
    await this.collectFolders(
      await this.getContentDirectory(),
      "",
      folders,
      [],
    );
    return folders;
  }

  async createFolder(folderPath: string): Promise<void> {
    const normalizedPath = normalizeRelativePath(folderPath);
    if (
      normalizedPath === LEGACY_TRASH_DIRECTORY ||
      normalizedPath.startsWith(`${LEGACY_TRASH_DIRECTORY}/`)
    ) {
      throw new Error("不能创建回收目录");
    }
    await this.getDirectoryByPath(await this.getContentDirectory(), normalizedPath, true);
  }

  async renameFolder(folderPath: string, newName: string): Promise<void> {
    const normalizedPath = normalizeRelativePath(folderPath);
    const normalizedName = newName.trim();
    if (!normalizedPath) throw new Error("不能重命名根目录");
    if (
      normalizedPath === LEGACY_TRASH_DIRECTORY ||
      normalizedPath.startsWith(`${LEGACY_TRASH_DIRECTORY}/`)
    ) {
      throw new Error("不能重命名回收目录");
    }
    if (
      !normalizedName ||
      normalizedName.includes("/") ||
      normalizedName.includes("\\")
    ) {
      throw new Error("文件夹名称不能为空或包含路径分隔符");
    }

    const segments = normalizedPath.split("/");
    const oldName = segments.pop();
    if (!oldName) throw new Error("文件夹路径不合法");
    if (oldName === normalizedName) return;
    normalizeRelativePath([...segments, normalizedName].join("/"));

    const contentDirectory = await this.getContentDirectory();
    const parentDirectory = await this.getDirectoryByPath(
      contentDirectory,
      segments.join("/"),
      false,
    );
    const source = await parentDirectory.getDirectoryHandle(oldName);

    try {
      await parentDirectory.getDirectoryHandle(normalizedName);
      throw new Error(`文件夹“${normalizedName}”已存在`);
    } catch (error) {
      if (isNotFound(error)) {
        // target does not exist yet
      } else if (
        error instanceof DOMException &&
        error.name === "TypeMismatchError"
      ) {
        throw new Error(`文件夹“${normalizedName}”已存在`);
      } else {
        throw error;
      }
    }

    const target = await parentDirectory.getDirectoryHandle(normalizedName, {
      create: true,
    });
    try {
      await this.copyDirectoryContents(source, target);
      await parentDirectory.removeEntry(oldName, { recursive: true });
    } catch (error) {
      await parentDirectory
        .removeEntry(normalizedName, { recursive: true })
        .catch(() => undefined);
      throw error;
    }
  }

  async moveFile(
    documentPath: string,
    targetFolderPath: string,
  ): Promise<void> {
    const normalizedPath = normalizeRelativePath(documentPath);
    const segments = normalizedPath.split("/");
    const fileName = segments.pop();
    if (!fileName) throw new Error("文档路径不合法");
    const sourceFolderPath = segments.join("/");
    const normalizedTarget = normalizeRelativePath(targetFolderPath);
    if (
      normalizedTarget === LEGACY_TRASH_DIRECTORY ||
      normalizedTarget.startsWith(`${LEGACY_TRASH_DIRECTORY}/`)
    ) {
      throw new Error("不能移动到回收目录");
    }
    if (sourceFolderPath === normalizedTarget) return;

    const contentDirectory = await this.getContentDirectory();
    const sourceDirectory = await this.getDirectoryByPath(
      contentDirectory,
      sourceFolderPath,
      false,
    );
    const sourceHandle = await sourceDirectory.getFileHandle(fileName);
    const targetDirectory = await this.getDirectoryByPath(
      contentDirectory,
      normalizedTarget,
      true,
    );
    if (await fileExists(targetDirectory, fileName)) {
      throw new Error(`目标文件夹已存在同名文件“${fileName}”`);
    }

    await writeFile(targetDirectory, fileName, await sourceHandle.getFile());
    await sourceDirectory.removeEntry(fileName);
  }

  async get(id: string): Promise<LibraryFile | null> {
    try {
      const relativePath = `${normalizeRelativePath(id)}.md`;
      const handle = await this.getFileHandleByPath(await this.getContentDirectory(), relativePath);
      return this.readMarkdownHandle(handle, relativePath);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async create(input: SaveMarkdownInput): Promise<LibraryFile> {
    const id = safeDocumentId(input.title);
    if (!id) throw new Error("标题无法生成有效文件名");
    const folderPath = normalizeRelativePath(input.folderPath || "");
    const relativePath = [folderPath, `${id}.md`].filter(Boolean).join("/");
    const contentDirectory = await this.getContentDirectory();
    if (await this.filePathExists(contentDirectory, relativePath)) {
      throw new Error(`文档“${input.title}”已存在，请使用不同的标题`);
    }

    const now = new Date().toISOString();
    const frontMatter = {
      ...input.frontMatter,
      title: input.title,
      date: input.frontMatter.date || now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    };
    await this.writeFileByPath(
      contentDirectory,
      relativePath,
      serializeMarkdown(input.content || "", frontMatter),
    );

    return {
      id: this.documentId(relativePath),
      path: relativePath,
      folderPath,
      title: input.title,
      content: input.content || "",
      frontMatter,
      createdAt: now,
      updatedAt: now,
      type: "markdown",
    };
  }

  async update(
    id: string,
    input: SaveMarkdownInput,
  ): Promise<LibraryFile> {
    const originalPath = this.resolveDocumentId(id, ".md");
    const contentDirectory = await this.getContentDirectory();
    const originalHandle = await this.getFileHandleByPath(contentDirectory, originalPath);
    const originalFile = await originalHandle.getFile();
    const existing = parseMarkdown(await originalFile.text());
    const folderPath = documentFolder(originalPath);
    const desiredId = safeDocumentId(input.title || documentId(id));
    if (!desiredId) throw new Error("标题无法生成有效文件名");

    let finalPath = [folderPath, `${desiredId}.md`].filter(Boolean).join("/");
    if (finalPath !== originalPath && (await this.filePathExists(contentDirectory, finalPath))) {
      finalPath = [folderPath, `${desiredId}-${Date.now()}.md`]
        .filter(Boolean)
        .join("/");
    }

    const now = new Date().toISOString();
    const frontMatter = {
      ...existing.frontMatter,
      ...input.frontMatter,
      title: input.title || existing.frontMatter.title || id,
      createdAt:
        existing.frontMatter.createdAt ||
        new Date(originalFile.lastModified).toISOString(),
      updatedAt: now,
    };

    await this.writeFileByPath(
      contentDirectory,
      finalPath,
      serializeMarkdown(input.content || "", frontMatter),
    );
    if (finalPath !== originalPath) {
      await this.removeFileByPath(contentDirectory, originalPath);
    }

    return {
      id: this.documentId(finalPath),
      path: finalPath,
      folderPath,
      title: frontMatter.title,
      content: input.content || "",
      frontMatter,
      createdAt: frontMatter.createdAt,
      updatedAt: now,
      type: "markdown",
    };
  }

  async delete(id: string, documentPath?: string): Promise<void> {
    const sourcePath = documentPath
      ? normalizeRelativePath(documentPath)
      : this.resolveDocumentId(id, ".md");
    if (!sourcePath || sourcePath.split("/")[0].toLowerCase() === LEGACY_TRASH_DIRECTORY) {
      throw new Error("文档路径不合法");
    }
    const contentDirectory = await this.getContentDirectory();
    const sourceHandle = await this.getFileHandleByPath(contentDirectory, sourcePath);
    const sourceFile = await sourceHandle.getFile();
    const trashDirectory = await this.getTrashDirectory();

    let targetPath = sourcePath;
    if (await this.filePathExists(trashDirectory, targetPath)) {
      const extension = extensionFromPath(sourcePath);
      targetPath = `${sourcePath.slice(0, extension ? -extension.length : undefined)}-${crypto.randomUUID()}${extension}`;
    }

    await this.writeFileByPath(trashDirectory, targetPath, sourceFile);
    await this.removeFileByPath(contentDirectory, sourcePath);
  }

  async deleteFolder(folderPath: string): Promise<void> {
    const normalizedPath = normalizeRelativePath(folderPath);
    if (!normalizedPath || normalizedPath.split("/")[0].toLowerCase() === LEGACY_TRASH_DIRECTORY) {
      throw new Error("不能删除根目录或回收目录");
    }
    const segments = normalizedPath.split("/");
    const name = segments.pop()!;
    const contentDirectory = await this.getContentDirectory();
    const parent = await this.getDirectoryByPath(contentDirectory, segments.join("/"), false);
    const source = await parent.getDirectoryHandle(name);
    const trash = await this.getTrashDirectory();
    const trashName = `${name}-${crypto.randomUUID()}`;
    const target = await trash.getDirectoryHandle(trashName, { create: true });
    // Keep the source intact until the entire backup is written.
    await this.copyDirectoryContents(source, target, true);
    await parent.removeEntry(name, { recursive: true });
  }

  async readHtml(id: string): Promise<string> {
    const contentDirectory = await this.getContentDirectory();
    const normalizedId = normalizeRelativePath(id);
    for (const extension of [".html", ".htm"]) {
      const relativePath = `${normalizedId}${extension}`;
      if (await this.filePathExists(contentDirectory, relativePath)) {
        const handle = await this.getFileHandleByPath(
          contentDirectory,
          relativePath,
        );
        return (await handle.getFile()).text();
      }
    }
    throw new DOMException("HTML file not found", "NotFoundError");
  }

  async readFile(path: string): Promise<Blob> {
    const contentDirectory = await this.getContentDirectory();
    const handle = await this.getFileHandleByPath(
      contentDirectory,
      normalizeRelativePath(path),
    );
    return handle.getFile();
  }

  async saveImage(file: File): Promise<string> {
    const imagesDirectory = await this.getImagesDirectory(true);
    const fileName = await createImageAssetName(file);
    if (await fileExists(imagesDirectory, fileName)) {
      return toImageMarkdownPath(fileName);
    }

    const handle = await imagesDirectory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(file);
    await writable.close();
    return toImageMarkdownPath(fileName);
  }

  async readImage(source: string): Promise<Blob | null> {
    const fileName = getImageAssetName(source);
    if (!fileName) return null;

    try {
      const systemImage = source.replaceAll("\\", "/").includes(`${SYSTEM_DIRECTORY}/assets/images/`);
      const imagesDirectory = systemImage
        ? await this.getImagesDirectory(false)
        : await this.getLegacyImagesDirectory();
      const handle = await imagesDirectory.getFileHandle(fileName);
      return await handle.getFile();
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async getContentDirectory(): Promise<FileSystemDirectoryHandle> {
    if (this.layout === "root") return this.rootDirectory;
    return this.rootDirectory.getDirectoryHandle(LEGACY_DOCS_DIRECTORY);
  }

  private async getTrashDirectory(): Promise<FileSystemDirectoryHandle> {
    const system = await this.rootDirectory.getDirectoryHandle(SYSTEM_DIRECTORY, { create: true });
    return system.getDirectoryHandle(TRASH_DIRECTORY, { create: true });
  }

  private documentId(relativePath: string): string {
    return documentId(relativePath);
  }

  private resolveDocumentId(id: string, extension: ".md" | ".html"): string {
    return `${normalizeRelativePath(id)}${extension}`;
  }

  private async getImagesDirectory(
    create: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    const system = await this.rootDirectory.getDirectoryHandle(SYSTEM_DIRECTORY, { create });
    const assetsDirectory = await system.getDirectoryHandle(
      ASSETS_DIRECTORY,
      { create },
    );
    return assetsDirectory.getDirectoryHandle(IMAGES_DIRECTORY, { create });
  }

  private async getLegacyImagesDirectory(): Promise<FileSystemDirectoryHandle> {
    const assets = await this.rootDirectory.getDirectoryHandle(ASSETS_DIRECTORY);
    return assets.getDirectoryHandle(IMAGES_DIRECTORY);
  }

  private async readMarkdownHandle(
    handle: FileSystemFileHandle,
    relativePath = handle.name,
  ): Promise<LibraryFile> {
    const file = await handle.getFile();
    const parsed = parseMarkdown(await file.text());
    const id = this.documentId(relativePath);
    const fileTimestamp = new Date(file.lastModified).toISOString();

    return {
      id,
      path: relativePath,
      folderPath: documentFolder(relativePath),
      title: parsed.frontMatter.title || id,
      content: parsed.content,
      frontMatter: parsed.frontMatter,
      createdAt: parsed.frontMatter.createdAt || fileTimestamp,
      updatedAt: parsed.frontMatter.updatedAt || fileTimestamp,
      type: "markdown",
      extension: extensionFromPath(relativePath) || undefined,
    };
  }

  private async collectFiles(
    directory: FileSystemDirectoryHandle,
    prefix: string,
    documents: LibraryFile[],
    directoryStack: FileSystemDirectoryHandle[],
  ): Promise<void> {
    if (await isDirectoryInStack(directory, directoryStack)) return;
    directoryStack.push(directory);
    try {
      for (const [name, handle] of await listDirectoryEntries(directory)) {
        if (name.toLowerCase() === SYSTEM_DIRECTORY) continue;
        if (prefix === "" && name === LEGACY_TRASH_DIRECTORY) continue;
        if (name.toLowerCase().endsWith(".lnk")) continue;
        const relativePath = [prefix, name].filter(Boolean).join("/");
        if (handle.kind === "directory") {
          await this.collectFiles(
            handle as FileSystemDirectoryHandle,
            relativePath,
            documents,
            directoryStack,
          );
          continue;
        }

        if (handle.kind !== "file") continue;
        const fileHandle = handle as FileSystemFileHandle;

        const extension = extensionFromPath(name);
        const type = detectFileType(extension);
        if (type === "markdown" && extension === ".md") {
          documents.push(await this.readMarkdownHandle(fileHandle, relativePath));
          continue;
        }

        const file = await fileHandle.getFile();
        const timestamp = new Date(file.lastModified).toISOString();
        const id =
          type === "markdown" || type === "html"
            ? this.documentId(relativePath)
            : relativePath;
        const title =
          type === "markdown" || type === "html"
            ? name.slice(0, -extension.length)
            : name;
        documents.push({
          id,
          path: relativePath,
          folderPath: documentFolder(relativePath),
          title,
          content: "",
          frontMatter: { title },
          createdAt: timestamp,
          updatedAt: timestamp,
          type,
          extension: extension || undefined,
        });
      }
    } finally {
      directoryStack.pop();
    }
  }

  private async collectFolders(
    directory: FileSystemDirectoryHandle,
    prefix: string,
    folders: string[],
    directoryStack: FileSystemDirectoryHandle[],
  ): Promise<void> {
    if (await isDirectoryInStack(directory, directoryStack)) return;
    directoryStack.push(directory);
    try {
      for (const [name, handle] of await listDirectoryEntries(directory)) {
        if (name.toLowerCase() === SYSTEM_DIRECTORY) continue;
        if (!prefix && name === LEGACY_TRASH_DIRECTORY) continue;
        if (name.toLowerCase().endsWith(".lnk")) continue;
        if (handle.kind !== "directory") continue;
        const relativePath = [prefix, name].filter(Boolean).join("/");
        folders.push(relativePath);
        await this.collectFolders(
          handle as FileSystemDirectoryHandle,
          relativePath,
          folders,
          directoryStack,
        );
      }
    } finally {
      directoryStack.pop();
    }
  }

  private async getDirectoryByPath(
    root: FileSystemDirectoryHandle,
    relativePath: string,
    create: boolean,
  ): Promise<FileSystemDirectoryHandle> {
    let directory = root;
    for (const segment of normalizeRelativePath(relativePath).split("/").filter(Boolean)) {
      directory = await directory.getDirectoryHandle(segment, { create });
    }
    return directory;
  }

  private async getFileHandleByPath(
    root: FileSystemDirectoryHandle,
    relativePath: string,
  ): Promise<FileSystemFileHandle> {
    const normalizedPath = normalizeRelativePath(relativePath);
    const segments = normalizedPath.split("/");
    const fileName = segments.pop();
    if (!fileName) throw new Error("文档路径不合法");
    const directory = await this.getDirectoryByPath(root, segments.join("/"), false);
    return directory.getFileHandle(fileName);
  }

  private async filePathExists(
    root: FileSystemDirectoryHandle,
    relativePath: string,
  ): Promise<boolean> {
    try {
      await this.getFileHandleByPath(root, relativePath);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  private async writeFileByPath(
    root: FileSystemDirectoryHandle,
    relativePath: string,
    content: string | File,
  ): Promise<void> {
    const normalizedPath = normalizeRelativePath(relativePath);
    const segments = normalizedPath.split("/");
    const fileName = segments.pop();
    if (!fileName) throw new Error("文档路径不合法");
    const directory = await this.getDirectoryByPath(root, segments.join("/"), true);
    await writeFile(directory, fileName, content);
  }

  private async removeFileByPath(
    root: FileSystemDirectoryHandle,
    relativePath: string,
  ): Promise<void> {
    const normalizedPath = normalizeRelativePath(relativePath);
    const segments = normalizedPath.split("/");
    const fileName = segments.pop();
    if (!fileName) throw new Error("文档路径不合法");
    const directory = await this.getDirectoryByPath(root, segments.join("/"), false);
    await directory.removeEntry(fileName);
  }

  private async copyDirectoryContents(
    source: FileSystemDirectoryHandle,
    target: FileSystemDirectoryHandle,
    includeShortcuts = false,
  ): Promise<void> {
    const entries: Array<[string, FileSystemHandle]> = [];
    for await (const entry of source.entries()) {
      entries.push(entry);
    }

    for (const [name, handle] of entries) {
      if (!includeShortcuts && name.toLowerCase().endsWith(".lnk")) continue;
      if (handle.kind === "directory") {
        const child = await target.getDirectoryHandle(name, { create: true });
        await this.copyDirectoryContents(
          handle as FileSystemDirectoryHandle,
          child,
          includeShortcuts,
        );
      } else if (handle.kind === "file") {
        await writeFile(
          target,
          name,
          await (handle as FileSystemFileHandle).getFile(),
        );
      }
    }
  }
}

export const markdownFile = {
  parse: parseMarkdown,
  serialize: serializeMarkdown,
  safeDocumentId,
};
