# Xylo 本地知识库

基于 React、TypeScript 和 Vite 的 Chrome / Edge Manifest V3 扩展。文档和粘贴图片直接保存在用户授权的本地知识库目录，不依赖 Web 服务、数据库或源码目录。

项目名为 `xylo-knowledge-base`，以 Markdown 编辑和阅读为核心，提供文件整理与多类型预览。知识库是授权的本地目录，工作区是文件树与编辑器组成的操作界面。现有源码磁盘路径可继续保留，避免改变未打包扩展的加载路径和扩展 ID。

## 安装与分发

开发者需要 Node.js 22.12+：

```bash
npm install
npm run build
```

在浏览器扩展管理页开启开发者模式，加载 `dist-extension`。向同事分发时只发送整个 `dist-extension` 目录，不要发送源码、个人知识库或数据库。同事不需要安装 Node.js。

`npm run build:extension` 是同一构建流程的兼容别名。`npm run dev` 仅用于扩展开发，不提供独立 Web 版本。

项目统一使用 npm，`package-lock.json` 纳入版本控制；自动化安装使用 `npm ci`。构建产物、自动生成的看板娘运行库和模型、本机配置及个人知识库数据不提交。

## 源码结构

```text
extension/       Manifest V3 配置、页面入口和品牌图标
src/extension/   扩展入口、后台 Service Worker、HTML 沙箱
src/components/  文件工作区、编辑器和预览组件
src/contexts/    主题和知识库仓储上下文
src/repositories/ 本地文件系统仓储
src/strategies/  文件类型与预览策略
src/lib/         路径、图片、目录授权等公共逻辑
src/styles/      工作区样式
src/types/       文件及第三方类型
public/          看板娘沙箱和静态资源
scripts/         构建、回归测试、数据迁移和图片清理
```

本仓库仅维护 Chrome / Edge 插件版本，不包含 Next.js 页面、服务端 API 或数据库服务。知识库内容独立于源码仓库。

## 独立知识库

首次打开扩展选择任意目录即可，空目录和已有文件的目录都支持，无需 `docs` 子目录。选择的目录就是文档根目录，新建文档直接写入该目录或选中的子文件夹；连接时不会自动创建文件夹。

```text
我的知识库/
  笔记.md               文档
  工作/                 用户子目录
  .xylo-system/         插件系统目录，不在插件中展示（按需创建）
    trash/              删除内容的回收副本
    assets/
      images/           粘贴图片，按内容哈希去重
```

侧栏的“切换知识库”按钮可以更换目录；未保存的修改会先提示。取消选择或授权失败不会切走当前知识库。最近文档和解锁状态按知识库隔离，主题、视觉特效等偏好为应用级设置。

`.xylo-system` 及其内容不会进入文件树、文档列表和搜索结果，也不能通过插件的文档操作修改。此处的隐藏仅指插件界面，并非 Windows 隐藏属性。已有的旧 `assets/images` 和 `garbage` 不自动迁移或删除，旧图片引用仍然兼容；新图片和回收内容统一写入系统目录。备份时务必包含系统目录。

新回收内容使用 `.xylo-system/trash`；已有的 `.xylo-system/garbage` 保留不动，不自动改名。插件图标和界面品牌标识共用 `extension/icons/brand.svg`，运行 `npm run icons:generate` 可生成各尺寸 PNG。

目录句柄保存在当前浏览器的 IndexedDB 中；权限失效时重新授权，也可选择其他目录。重装扩展或清理浏览器数据后可能需要重新选择。关闭扩展不会删除知识库文件，备份时复制整个知识库目录即可。

升级前保存的旧知识库连接仍按原来的 `docs` 结构恢复，不移动文件。重新选择目录后统一按目录本身读取，`docs` 不再有特殊含义，可以直接选择它管理文档。选择旧知识库的父目录时，`docs` 会作为普通子文件夹显示，原有图片仍可读取。若直接选择旧 `docs` 子目录，浏览器授权不包含它的父目录，旧图片需一并复制到所选目录内的 `assets/images`。

## 迁移源码目录中的旧数据

先关闭编辑页面，准备一个独立的空目录。例如迁移到 `D:\XyloLibrary`：

```powershell
npm run library:migrate -- --source "E:\workspace-ai\xylo-agent" --target "D:\XyloLibrary"
npm run library:migrate -- --source "E:\workspace-ai\xylo-agent" --target "D:\XyloLibrary" --apply
```

第一条仅预览；第二条复制 `docs`（含回收内容）、旧 `assets/images` 和已有的 `.xylo-system` 并校验 SHA-256，不改写 Markdown、不覆盖目标文件、不删除源数据，不迁移目录链接。目标目录的父目录需要已经存在。

完成后通过扩展“切换知识库”选择新目录，迁移保留的 `docs` 会作为普通子文件夹显示。旧的 `../assets/images/…` 引用继续兼容。源码内现有数据不会自动删除；`.gitignore` 也不会自动取消已跟踪文件，确认迁移完整后再处理旧数据和 Git 跟踪，历史提交中的个人内容同样不会自动消失。

## 维护

```bash
npm run lint
npm test
npm run images:clean -- --root "D:\XyloLibrary"
```

图片清理同时扫描系统图片目录和旧图片目录，并保留回收文档引用的图片；默认只预览，添加 `--delete` 才删除未引用图片。不要在编辑或同步文件期间运行清理。

`npm test` 验证根目录文档读写、改名移动、图片去重、系统目录隐藏，以及本地文件删除、二进制回收副本、同名冲突、路径保护和备份失败时保留原文件。

看板娘模型及运行库的第三方许可见 `public/companion/THIRD-PARTY-NOTICES.md`，对外分发或商业使用前需核对各模型及 SDK 的授权条款。
