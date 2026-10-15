import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "public", "companion");
const characters = JSON.parse(await readFile(path.join(root, "src/lib/companion-characters.json"), "utf8"));
await mkdir(output, { recursive: true });
const runtime = await readFile(path.join(root, "node_modules/oh-my-live2d/dist/index.min.js"), "utf8");
const source = ts.createSourceFile("runtime.js", runtime, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const scripts = new Set();
const sdkLoaders = [];
function collect(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      ts.isCallExpression(node.initializer) && ts.isPropertyAccessExpression(node.initializer.expression) &&
      node.initializer.expression.expression.getText(source) === "document" &&
      node.initializer.expression.name.text === "createElement" && node.initializer.arguments[0]?.text === "script") {
    scripts.add(node.name.text);
  }
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) && scripts.has(node.expression.expression.text) &&
      node.expression.name.text === "append" && node.arguments.length === 1 &&
      ts.isNoSubstitutionTemplateLiteral(node.arguments[0])) {
    sdkLoaders.push({ start: node.getStart(source), end: node.end, code: node.arguments[0].text });
  }
  ts.forEachChild(node, collect);
}
collect(source);
if (sdkLoaders.length !== 1 || !sdkLoaders[0].code.includes("Live2D")) {
  throw new Error("Live2D SDK bootstrap changed; review the offline runtime preparation.");
}
const sdk = sdkLoaders[0];
// Load Cubism as a packaged script, never through CSP-blocked inline injection.
await writeFile(path.join(output, "live2d.js"), sdk.code);
await writeFile(path.join(output, "runtime.js"), runtime.slice(0, sdk.start) + "void 0" + runtime.slice(sdk.end));
await cp(path.join(root, "node_modules/oh-my-live2d/LICENSE"), path.join(output, "OH-MY-LIVE2D-LICENSE.txt"));

const references = ["model", "physics", "pose", "file", "sound"];
const mimeTypes = { ".json": "application/json", ".png": "image/png", ".mp3": "audio/mpeg" };
async function embed(modelRoot, value, key = "") {
  if (typeof value === "string" && (references.includes(key) || key === "texture")) {
    const data = await readFile(path.join(modelRoot, value));
    const mime = mimeTypes[path.extname(value)] || "application/octet-stream";
    return `data:${mime};base64,${data.toString("base64")}`;
  }
  if (Array.isArray(value)) return Promise.all(value.map((item) => embed(modelRoot, item, key === "textures" ? "texture" : key)));
  if (value && typeof value === "object") {
    const entries = await Promise.all(Object.entries(value).map(async ([name, item]) => [name, await embed(modelRoot, item, name)]));
    return Object.fromEntries(entries);
  }
  return value;
}
// Data URLs let the sandbox load the model without privileged extension access or CORS.
for (const character of characters) {
  const modelPath = path.join(root, `node_modules/live2d-widget-model-${character.id}`, character.model);
  const modelRoot = path.dirname(modelPath);
  const model = JSON.parse(await readFile(modelPath, "utf8"));
  const embedded = await embed(modelRoot, model);
  const modelUrl = `data:application/json;base64,${Buffer.from(JSON.stringify(embedded)).toString("base64")}`;
  await writeFile(path.join(output, `model-${character.id}.js`), `window.XYLO_COMPANION_MODEL = ${JSON.stringify(modelUrl)};\n`);
}
await writeFile(path.join(output, "model.js"), `window.XYLO_COMPANION_CHARACTERS = ${JSON.stringify(characters)};\n`);
console.log("Prepared offline Live2D runtime and character models.");
