import {
  cp,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

async function promoteHtmlEntry(output, fileName) {
  const source = path.join(output, "extension", fileName);
  const target = path.join(output, fileName);
  const html = await readFile(source, "utf8");
  await writeFile(target, html.replaceAll("../assets/", "./assets/"), "utf8");
}

async function main() {
  const root = path.resolve(scriptDirectory, "..");
  const output = path.join(root, "dist-extension");
  const characters = JSON.parse(await readFile(path.join(root, "src/lib/companion-characters.json"), "utf8"));
  const modelFiles = new Set(characters.map((character) => `model-${character.id}.js`));
  await mkdir(output, { recursive: true });
  await copyFile(
    path.join(root, "extension", "manifest.json"),
    path.join(output, "manifest.json"),
  );
  await cp(path.join(root, "extension", "icons"), path.join(output, "icons"), {
    recursive: true,
  });
  await cp(path.join(root, "public", "companion"), path.join(output, "companion"), {
    recursive: true,
    filter: (source) => {
      const file = path.basename(source);
      return !file.startsWith("model-") || modelFiles.has(file);
    },
  });
  await copyFile(path.join(root, "public", "companion.html"), path.join(output, "companion.html"));
  await promoteHtmlEntry(output, "index.html");
  await promoteHtmlEntry(output, "sandbox.html");
  await rm(path.join(output, "extension"), { recursive: true, force: true });

  const manifest = JSON.parse(
    await readFile(path.join(output, "manifest.json"), "utf8"),
  );
  const requiredFiles = [
    "manifest.json",
    "index.html",
    "sandbox.html",
    "companion.html",
    "companion/live2d.js",
    "companion/runtime.js",
    "companion/model.js",
    ...characters.map((character) => `companion/model-${character.id}.js`),
    manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  await Promise.all(
    requiredFiles.map((file) => readFile(path.join(output, file))),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
