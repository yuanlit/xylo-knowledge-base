const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createRequire } = require("node:module");
const ts = require("typescript");

const workspace = path.resolve(__dirname, "..");
const modules = new Map();
async function loadSource(relativePath) {
  const filename = path.join(workspace, relativePath);
  if (modules.has(filename)) return modules.get(filename);
  const source = await fs.readFile(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies = new Map();
  for (const match of compiled.matchAll(/require\("(@\/[^\"]+)"\)/g)) {
    dependencies.set(match[1], await loadSource(`src/${match[1].slice(2)}.ts`));
  }
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => dependencies.has(name) ? dependencies.get(name) : localRequire(name), module, module.exports,
  );
  modules.set(filename, module.exports);
  return module.exports;
}

class DirectoryHandle {
  constructor(directory, failure = { enabled: false }) {
    this.directory = directory;
    this.name = path.basename(directory);
    this.failure = failure;
    this.kind = "directory";
  }
  async isSameEntry(other) {
    return path.resolve(this.directory) === path.resolve(other.directory);
  }
  async getDirectoryHandle(name, options = {}) {
    const target = path.join(this.directory, name);
    if (options.create) await fs.mkdir(target, { recursive: true });
    try { await fs.access(target); }
    catch (error) {
      if (error.code === "ENOENT") throw new DOMException("Missing directory", "NotFoundError");
      throw error;
    }
    return new DirectoryHandle(target, this.failure);
  }
  async getFileHandle(name, options = {}) {
    const target = path.join(this.directory, name);
    if (!options.create) {
      try { await fs.access(target); }
      catch (error) {
        if (error.code === "ENOENT") throw new DOMException("Missing file", "NotFoundError");
        throw error;
      }
    }
    return {
      kind: "file", name,
      getFile: async () => new File([await fs.readFile(target)], name),
      createWritable: async () => ({
        write: async (content) => {
          if (this.failure.enabled) throw new Error("Simulated write failure");
          await fs.writeFile(target, typeof content === "string" ? content : Buffer.from(await content.arrayBuffer()));
        },
        close: async () => {},
      }),
    };
  }
  async *entries() {
    for (const entry of await fs.readdir(this.directory, { withFileTypes: true })) {
      yield [entry.name, entry.isDirectory()
        ? new DirectoryHandle(path.join(this.directory, entry.name), this.failure)
        : await this.getFileHandle(entry.name)];
    }
  }
  async removeEntry(name, options = {}) {
    const target = path.resolve(this.directory, name);
    assert.equal(path.dirname(target), path.resolve(this.directory));
    await fs.rm(target, { recursive: !!options.recursive });
  }
}

async function run() {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "xylo-file-operations-"));
  const originalCwd = process.cwd();
  const docs = path.join(fixture, "docs");
  const trash = path.join(fixture, ".xylo-system", "trash");
  const bytes = Buffer.from([0, 255, 128, 13, 10, 0, 42]);
  const exists = async (target) => fs.access(target).then(() => true, () => false);
  try {
    await fs.mkdir(docs);
    const { FileSystemLibraryRepository } = await loadSource("src/repositories/file-system-library-repository.ts");
    process.chdir(originalCwd);

    const failure = { enabled: false };
    const repository = new FileSystemLibraryRepository(new DirectoryHandle(fixture, failure), "fixture", "docs");
    await fs.mkdir(path.join(docs, "extension/nested"), { recursive: true });
    await fs.writeFile(path.join(docs, "extension/nested/data.bin"), bytes);
    await fs.writeFile(path.join(docs, "extension/shortcut.lnk"), bytes);
    await repository.deleteFolder("extension");
    assert.equal(await exists(path.join(docs, "extension")), false);
    const extensionBackup = (await fs.readdir(trash)).find((name) => name.startsWith("extension-"));
    assert.deepEqual(await fs.readFile(path.join(trash, extensionBackup, "nested/data.bin")), bytes);
    assert.deepEqual(await fs.readFile(path.join(trash, extensionBackup, "shortcut.lnk")), bytes);
    for (let index = 0; index < 2; index++) {
      await fs.writeFile(path.join(docs, "ext.bin"), bytes);
      await repository.delete("ext.bin", "ext.bin");
    }
    const extensionFiles = (await fs.readdir(trash)).filter((name) => name.startsWith("ext") && name.endsWith(".bin"));
    assert.equal(extensionFiles.length, 2);
    for (const file of extensionFiles) assert.deepEqual(await fs.readFile(path.join(trash, file)), bytes);
    for (const folderPath of ["", "..", "garbage", "garbage/child", "Garbage", ".xylo-system", ".xylo-system/assets", ".XYLO-SYSTEM"]) await assert.rejects(repository.deleteFolder(folderPath));
    await fs.mkdir(path.join(docs, "failure"));
    await fs.writeFile(path.join(docs, "failure/data.bin"), bytes);
    failure.enabled = true;
    await assert.rejects(repository.deleteFolder("failure"), /Simulated write failure/);
    assert.deepEqual(await fs.readFile(path.join(docs, "failure/data.bin")), bytes);
    console.log("PASS: extension binary deletion, collision backups, recursive backup, shortcuts, path protection, copy-failure source retention");

    failure.enabled = false;
    const root = path.join(fixture, "root-library");
    await fs.mkdir(root);
    const flat = new FileSystemLibraryRepository(new DirectoryHandle(root), "flat-fixture");
    assert.deepEqual(await flat.list(), []);
    assert.deepEqual(await fs.readdir(root), []);
    const created = await flat.create({ title: "First Note", content: "# Start", frontMatter: { tags: ["test"] } });
    assert.equal(created.path, "first-note.md");
    assert.equal((await flat.get(created.id)).content, "# Start");
    await assert.rejects(flat.create({ title: "First Note", content: "duplicate", frontMatter: {} }));
    const updated = await flat.update(created.id, { title: "Renamed Note", content: "# Updated", frontMatter: {} });
    assert.equal(await flat.get(created.id), null);
    assert.deepEqual((await flat.get(updated.id)).frontMatter.tags, ["test"]);
    await flat.createFolder("notes/nested");
    await flat.moveFile(updated.path, "notes/nested");
    assert.equal(await flat.get(updated.id), null);
    assert.equal((await flat.get("notes/nested/renamed-note")).content, "# Updated");
    await flat.renameFolder("notes", "archive");
    assert.equal((await flat.list())[0].path, "archive/nested/renamed-note.md");
    const image = new File([bytes], "[photo].png", { type: "image/png" });
    const imagePath = await flat.saveImage(image);
    assert.match(imagePath, /^\.xylo-system\/assets\/images\/[a-f0-9]{64}\.png$/);
    assert.equal(await flat.saveImage(image), imagePath);
    assert.deepEqual(Buffer.from(await (await flat.readImage(imagePath)).arrayBuffer()), bytes);
    assert.equal((await fs.readdir(path.join(root, ".xylo-system/assets/images"))).length, 1);
    assert.deepEqual(await flat.listFolders(), ["archive", "archive/nested"]);
    assert.equal((await flat.list()).length, 1);
    const { imageAltText } = await loadSource("src/lib/image-assets.ts");
    assert.equal(imageAltText(image), "photo");
    console.log("PASS: flat-root CRUD, metadata preservation, folder moves, image deduplication, system-directory exclusion");
  } finally {
    process.chdir(originalCwd);
    assert.equal(path.dirname(path.resolve(fixture)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith("xylo-file-operations-"));
    await fs.rm(fixture, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
