// Front Matter is user-authored YAML and intentionally supports arbitrary values.
export type DocumentFrontMatter = Record<string, any>;

export type LibraryFileType =
  | "markdown"
  | "html"
  | "image"
  | "text"
  | "binary";

export interface LibraryFile {
  id: string;
  path: string;
  folderPath: string;
  title: string;
  content: string;
  frontMatter: DocumentFrontMatter;
  createdAt: string;
  updatedAt: string;
  type?: LibraryFileType;
  extension?: string;
}

export interface SaveMarkdownInput {
  title: string;
  content: string;
  frontMatter: DocumentFrontMatter;
  folderPath?: string;
}
