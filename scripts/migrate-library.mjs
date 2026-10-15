import { constants } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

function argumentsFrom(args) {
  const options = { apply: false };
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (key === "--apply") options.apply = true;
    else if (["--source", "--target"].includes(key) && args[index + 1]) {
      options[key.slice(2)] = path.resolve(args[++index]);
    } else throw new Error(`Unknown argument: ${key}`);
  }
  if (!options.source || !options.target) throw new Error("Usage: npm run library:migrate -- --source <old-root> --target <empty-directory> [--apply]");
  return options;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

async function resolvedTarget(target) {
  try { return await fs.realpath(target); } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return path.join(await fs.realpath(path.dirname(target)), path.basename(target));
  }
}

async function collect(source, relative, files, directories) {
  const absolute = path.join(source, relative);
  const stats = await fs.lstat(absolute);
  if (stats.isSymbolicLink()) throw new Error(`Directory links are not migrated: ${relative}`);
  if (stats.isDirectory()) {
    directories.push(relative);
    for (const name of await fs.readdir(absolute)) await collect(source, path.join(relative, name), files, directories);
  } else if (stats.isFile()) files.push(relative);
  else throw new Error(`Unsupported entry: ${relative}`);
}

const digest = async (file) => createHash("sha256").update(await fs.readFile(file)).digest("hex");

async function main() {
  const options = argumentsFrom(process.argv.slice(2));
  const source = await fs.realpath(options.source);
  const target = await resolvedTarget(options.target);
  if (isWithin(source, target) || isWithin(target, source)) throw new Error("Source and target must be separate, non-nested directories");
  try {
    if ((await fs.readdir(target)).length) throw new Error("Target directory must be empty");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  const files = [];
  const directories = [];
  await collect(source, "docs", files, directories);
  const images = path.join("assets", "images");
  try {
    const assets = await fs.lstat(path.join(source, "assets"));
    if (assets.isSymbolicLink()) throw new Error("Assets directory must not be a directory link");
    await collect(source, images, files, directories);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  try {
    await collect(source, ".xylo-system", files, directories);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  console.log(`Source: ${source}\nTarget: ${target}\nFiles: ${files.length}`);
  if (!options.apply) {
    console.log("Preview only. Add --apply to copy. Source data will not be removed.");
    return;
  }
  // Exclusive writes prevent overwriting a file even if the target changes during migration.
  for (const directory of ["docs", images, ...directories]) await fs.mkdir(path.join(target, directory), { recursive: true });
  for (const relative of files) {
    const input = path.join(source, relative);
    const output = path.join(target, relative);
    await fs.copyFile(input, output, constants.COPYFILE_EXCL);
    if (await digest(input) !== await digest(output)) throw new Error(`Copy verification failed: ${relative}`);
  }
  console.log(`Copied and verified ${files.length} files. Source data is unchanged.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
