import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
]);
const IMAGE_REFERENCE_PATTERN = /(?:\.\.\/|\.\/|\/)*assets\/images\/([a-zA-Z0-9][a-zA-Z0-9._-]*)/g;

async function listFiles(directory, predicate) {
  const files = [];
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath, predicate));
    } else if (entry.isFile() && predicate(entryPath)) {
      files.push(entryPath);
    }
  }
  return files;
}

export function findImageReferences(markdown) {
  const references = new Set();
  const normalized = markdown.replaceAll("\\", "/");
  for (const match of normalized.matchAll(IMAGE_REFERENCE_PATTERN)) {
    references.add(match[1]);
  }
  return references;
}

export async function findUnusedImages(rootDirectory) {
  const imagesDirectories = [
    path.join(rootDirectory, ".xylo-system", "assets", "images"),
    path.join(rootDirectory, "assets", "images"),
  ];
  const markdownFiles = await listFiles(
    rootDirectory,
    (filePath) => path.extname(filePath).toLowerCase() === ".md",
  );
  const imageFiles = (await Promise.all(imagesDirectories.map((directory) => listFiles(
    directory,
    (filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
  )))).flat();

  const referencedNames = new Set();
  for (const markdownFile of markdownFiles) {
    const content = await fs.readFile(markdownFile, "utf8");
    for (const name of findImageReferences(content)) {
      referencedNames.add(name);
    }
  }

  return {
    imagesDirectories,
    markdownCount: markdownFiles.length,
    imageCount: imageFiles.length,
    referencedCount: referencedNames.size,
    unusedFiles: imageFiles.filter(
      (filePath) => !referencedNames.has(path.basename(filePath)),
    ),
  };
}

function parseArguments(args) {
  let rootDirectory;
  let shouldDelete = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--delete") {
      shouldDelete = true;
    } else if (argument === "--root") {
      const value = args[index + 1];
      if (!value) throw new Error("--root 需要指定目录");
      rootDirectory = path.resolve(value);
      index += 1;
    } else {
      throw new Error(`未知参数：${argument}`);
    }
  }

  if (!rootDirectory) throw new Error("请通过 --root 指定知识库目录");
  return { rootDirectory: path.resolve(rootDirectory), shouldDelete };
}

async function main() {
  const { rootDirectory, shouldDelete } = parseArguments(process.argv.slice(2));
  const result = await findUnusedImages(rootDirectory);

  console.log(`知识库目录：${rootDirectory}`);
  console.log(`扫描 Markdown：${result.markdownCount} 个`);
  console.log(`扫描图片：${result.imageCount} 个`);

  if (result.unusedFiles.length === 0) {
    console.log("没有发现未引用图片。");
    return;
  }

  console.log(`未引用图片：${result.unusedFiles.length} 个`);
  for (const filePath of result.unusedFiles) {
    console.log(`- ${path.relative(rootDirectory, filePath)}`);
  }

  if (!shouldDelete) {
    console.log("当前为预览模式，添加 --delete 后才会删除以上文件。");
    return;
  }

  const resolvedImagesDirectories = result.imagesDirectories.map((directory) => path.resolve(directory));
  for (const filePath of result.unusedFiles) {
    const resolvedFile = path.resolve(filePath);
    if (!resolvedImagesDirectories.some((directory) => resolvedFile.startsWith(`${directory}${path.sep}`))) {
      throw new Error(`拒绝删除图片目录外的文件：${resolvedFile}`);
    }
    await fs.unlink(resolvedFile);
  }
  console.log(`已删除 ${result.unusedFiles.length} 个未引用图片。`);
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
