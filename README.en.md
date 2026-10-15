# Xylo Local Knowledge Base

[中文](README.md)

A Chrome / Edge Manifest V3 extension built with React, TypeScript and Vite. Documents and pasted images are stored directly in a local knowledge base directory the user authorizes. It requires no web service, database or source directory.

The project is named `xylo-knowledge-base`. Markdown editing and reading are at its core, alongside file organization and previews for multiple content types. The knowledge base is an authorized local directory; the workspace is the interface formed by the file tree and editor. The existing source path on disk is kept as is, so the load path and extension ID of the unpacked extension stay unchanged.

## Install and distribute

Developers need Node.js 22.12+:

```bash
npm install
npm run build
```

Enable developer mode on the browser's extension management page and load `dist-extension`. To distribute to colleagues, send the entire `dist-extension` directory only — never the source, your personal knowledge base or the database. Colleagues do not need Node.js installed.

`npm run build:extension` is a compatible alias for the same build pipeline. `npm run dev` is for extension development only; there is no standalone web version.

The project uses npm exclusively, `package-lock.json` is under version control, and automated installs use `npm ci`. Build output, the auto-generated companion runtime and models, local configuration and personal knowledge base data are not committed.

## Source layout

```text
extension/       Manifest V3 configuration, page entries and brand icons
src/extension/   Extension entry, background service worker, HTML sandbox
src/components/  File workspace, editor and preview components
src/contexts/    Theme and knowledge base repository contexts
src/repositories/ Local file system repositories
src/strategies/  File type and preview strategies
src/lib/         Shared path, image and directory authorization logic
src/styles/      Workspace styles
src/types/       File and third-party types
public/          Companion sandbox and static assets
scripts/         Build, regression tests, data migration and image cleanup
```

This repository maintains the Chrome / Edge extension only. It contains no Next.js pages, server API or database service. Knowledge base content is independent of the source repository.

## Standalone knowledge base

On first launch, choose any directory. Empty directories and directories that already contain files are both supported; no `docs` subdirectory is required. The directory you choose is the document root. New documents are written directly into that directory or into the selected subfolder; no folders are created automatically on connect.

```text
My Knowledge Base/
  note.md               document
  work/                 user subdirectory
  .xylo-system/         extension system directory, hidden in the extension (created on demand)
    trash/              recycling copies of deleted content
    assets/
      images/           pasted images, deduplicated by content hash
```

The "Switch knowledge base" button in the sidebar changes the directory; unsaved changes prompt first. Cancelling the selection or a failed authorization does not switch away from the current knowledge base. Recent documents and unlock state are isolated per knowledge base, while preferences such as theme and visual effects are application-level settings.

`.xylo-system` and its contents never appear in the file tree, document list or search results, and cannot be modified through the extension's document operations. Hidden here refers to the extension interface only, not the Windows hidden attribute. Existing older `assets/images` and `garbage` directories are neither migrated nor deleted automatically, and old image references remain compatible; new images and recycled content are written into the system directory. Always include the system directory when backing up.

New recycled content goes to `.xylo-system/trash`; an existing `.xylo-system/garbage` is left untouched and not renamed automatically. The extension icon and interface branding share `extension/icons/brand.svg`; run `npm run icons:generate` to generate PNGs in each size.

Directory handles are stored in the current browser's IndexedDB; reauthorize if permission expires, or choose a different directory. Reinstalling the extension or clearing browser data may require selecting the directory again. Closing the extension does not delete knowledge base files — copying the entire knowledge base directory is enough for a backup.

Knowledge base connections saved before an upgrade are still restored with the original `docs` structure, without moving files. After selecting a directory again, everything is read relative to the directory itself; `docs` no longer carries special meaning, and you can select it directly to manage documents. When you select the parent directory of an old knowledge base, `docs` appears as an ordinary subfolder and the existing images remain readable. If you select the old `docs` subdirectory directly, the browser authorization does not cover its parent directory, and the old images must be copied into `assets/images` inside the selected directory.

## Migrate old data from the source directory

Close the editing page first and prepare a separate empty directory. For example, to migrate to `D:\XyloLibrary`:

```powershell
npm run library:migrate -- --source "E:\workspace-ai\xylo-agent" --target "D:\XyloLibrary"
npm run library:migrate -- --source "E:\workspace-ai\xylo-agent" --target "D:\XyloLibrary" --apply
```

The first command only previews. The second copies `docs` (including recycled content), the old `assets/images` and any existing `.xylo-system`, and verifies SHA-256. It does not rewrite Markdown, overwrite target files or delete source data, and it does not migrate directory links. The parent directory of the target must already exist.

When done, choose the new directory through "Switch knowledge base" in the extension; the preserved `docs` appears as an ordinary subfolder. Old `../assets/images/…` references remain compatible. Data currently in the source directory is not deleted automatically, and `.gitignore` does not automatically untrack files that are already tracked — handle the old data and Git tracking only after confirming the migration is complete. Personal content in historical commits will not disappear on its own either.

## Maintenance

```bash
npm run lint
npm test
npm run images:clean -- --root "D:\XyloLibrary"
```

Image cleanup scans both the system image directory and the old image directory, and keeps images referenced by recycled documents. It previews by default; only adding `--delete` removes unreferenced images. Do not run cleanup while editing or syncing files.

`npm test` verifies root-level document read and write, rename and move, image deduplication and system directory hiding, as well as local file deletion, binary recycling copies, name collisions, path protection, and retaining the original file when a backup fails.

For third-party licenses covering the companion models and runtime, see `public/companion/THIRD-PARTY-NOTICES.md`. Check the terms of each model and SDK before redistributing or using them commercially.
