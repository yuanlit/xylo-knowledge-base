import type { LibraryFile, SaveMarkdownInput } from "@/types/library-file";

export interface LibraryRepository {
  readonly storageKey?: string;
  readonly name?: string;
  list(): Promise<LibraryFile[]>;
  listFolders(): Promise<string[]>;
  get(id: string): Promise<LibraryFile | null>;
  create(input: SaveMarkdownInput): Promise<LibraryFile>;
  update(id: string, input: SaveMarkdownInput): Promise<LibraryFile>;
  delete(id: string, documentPath?: string): Promise<void>;
  readHtml(id: string): Promise<string>;
  readFile(path: string): Promise<Blob>;
  saveImage(file: File): Promise<string>;
  readImage(source: string): Promise<Blob | null>;
  createFolder?(folderPath: string): Promise<void>;
  renameFolder?(folderPath: string, newName: string): Promise<void>;
  deleteFolder?(folderPath: string): Promise<void>;
  moveFile?(documentPath: string, targetFolderPath: string): Promise<void>;
}
