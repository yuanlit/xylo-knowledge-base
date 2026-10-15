"use client";

import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "@/contexts/theme-context";
import { CalendarDays, Clock3, Tags, PanelRightClose, PanelRightOpen, SlidersHorizontal, Save, LoaderCircle, Maximize2, X, ZoomIn, ZoomOut, Scan } from "lucide-react";
import { IconButton } from "@/components/icon-button";
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import mermaid from 'mermaid';
import { TableOfContents } from "@/components/table-of-contents";
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { DocumentMetadataEditor } from "@/components/document-metadata-editor";
import { showToast } from "@/lib/toast";
import { useLibraryRepository } from "@/contexts/library-repository-context";
import { getImageAssetName, imageAltText } from "@/lib/image-assets";
import {
  handleOrderedListDeletion,
  handleOrderedListEnter,
} from "@/lib/ordered-list";
import type { LibraryRepository } from "@/repositories/library-repository";

function RepositoryImage({
  repository,
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  repository: LibraryRepository;
}) {
  const managedImage = typeof src === "string" ? getImageAssetName(src) : null;

  if (!managedImage || typeof src !== "string") {
    return <img {...props} alt={props.alt || ""} src={src} />;
  }

  return (
    <ManagedRepositoryImage
      {...props}
      repository={repository}
      source={src}
    />
  );
}

function ManagedRepositoryImage({
  repository,
  source,
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  repository: LibraryRepository;
  source: string;
}) {
  const [resolvedSource, setResolvedSource] = useState<string>();

  useEffect(() => {
    let objectUrl = "";
    let active = true;
    repository
      .readImage(source)
      .then((image) => {
        if (!active || !image) return;
        objectUrl = URL.createObjectURL(image);
        setResolvedSource(objectUrl);
      })
      .catch((error) => console.error("Failed to load image:", error));

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [repository, source]);

  if (!resolvedSource) return null;
  return <img {...props} alt={props.alt || ""} src={resolvedSource} />;
}

interface Document {
  id: string;
  title: string;
  content: string;
  frontMatter: any;
  createdAt: string;
  updatedAt: string;
}

interface FrontMatter {
  title: string;
  date?: string;
  excerpt?: string;
  tags?: string[];
  readTime?: number;
  coverImage?: string;
  password?: string;
  author?: string;
}

interface MarkdownEditorProps {
  document: Document | null;
  onSave: (title: string, content: string, frontMatter: FrontMatter) => Promise<void>;
  onClose: () => void;
  isNew?: boolean;
  isEditMode?: boolean;
  onExitEditMode?: () => void;
}

export interface MarkdownEditorRef {
  hasUnsavedChanges: () => boolean;
  hasPendingWrites: () => boolean;
}

// 统一的标题 ID 生成函数
const generateHeadingId = (text: string): string => {
  let id = text
    .toLowerCase()
    // 保留：字母、数字、中文字符、中文标点符号
    .replace(/[^\w\u4e00-\u9fa5\u3400-\u4dbf\u3000-\u303f]+/g, '-')
    // 将多个连续连字符替换为单个
    .replace(/-+/g, '-')
    // 移除开头和结尾的连字符
    .replace(/^-+|-+$/g, '');

  // 如果 ID 为空（比如全是特殊字符），使用时间戳和随机数作为后备
  if (!id) {
    id = `heading-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  return id;
};

// 提取 Markdown 标题的函数
const extractHeadings = (content: string): Array<{ level: number; text: string; id: string }> => {
  if (!content) return [];

  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const seenIds = new Set<string>(); // 用于去重，确保 ID 唯一
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = generateHeadingId(text);

    // 如果 ID 已存在，添加序号使其唯一
    let uniqueId = id;
    let counter = 1;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${id}-${counter}`;
      counter++;
    }

    seenIds.add(uniqueId);
    headings.push({ level, text, id: uniqueId });
  }

  return headings;
};


// 简单的代码提取函数
const getCodeString = (children: any): string => {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children.map(child => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      if (child === null || child === undefined) return '';
      if (child && typeof child === 'object') {
        // 处理 react-markdown 的节点结构
        if (child.type === 'text' && child.value !== undefined) {
          return String(child.value);
        }
        // 处理 React 元素
        if (child.props) {
          if (child.props.children) {
            return getCodeString(child.props.children);
          }
          if (child.props.value !== undefined) {
            return String(child.props.value);
          }
        }
        // 处理普通对象
        if (child.children) return getCodeString(child.children);
        if (child.value !== undefined) return String(child.value);
      }
      return '';
    }).filter(Boolean).join('');
  }
  if (children && typeof children === 'object') {
    // 处理 react-markdown 的节点结构
    if (children.type === 'text' && children.value !== undefined) {
      return String(children.value);
    }
    // 处理 React 元素
    if (children.props) {
      if (children.props.children) {
        return getCodeString(children.props.children);
      }
      if (children.props.value !== undefined) {
        return String(children.props.value);
      }
    }
    // 处理普通对象
    if (children.children) return getCodeString(children.children);
    if (children.value !== undefined) return String(children.value);
  }
  return '';
};

// 简单的 Mermaid 代码块组件
const MermaidCode = memo(({
  inline,
  children = [],
  className,
  ...props
}: any) => {
  const { mode } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMermaid = !inline && className && /^language-mermaid/.test(className.toLowerCase());

  // 提取代码 - react-markdown 的 code 组件会传递 node 属性
  let code = '';

  // 优先从 node.data 或 node.value 获取（react-markdown 的代码块数据）
  if (props.node?.data) {
    if (typeof props.node.data === 'string') {
      code = props.node.data;
    } else if (props.node.data.value) {
      code = String(props.node.data.value);
    }
  }

  // 其次从 node.value 获取
  if (!code && props.node?.value) {
    code = String(props.node.value);
  }

  // 然后从 node.children 获取
  if (!code && props.node?.children) {
    code = getCodeString(props.node.children);
  }

  // 最后从 children prop 获取
  if (!code && children) {
    if (typeof children === 'string') {
      code = children;
    } else if (Array.isArray(children)) {
      code = children
        .map(child => {
          if (typeof child === 'string') return child;
          if (typeof child === 'number') return String(child);
          return '';
        })
        .filter(Boolean)
        .join('');
    } else {
      code = getCodeString(children);
    }
  }

  const codeStr = code.trim();

  // 调试：如果代码包含 [object Object]，说明提取有问题
  if (codeStr.includes('[object Object]')) {
    console.warn('[Mermaid] Code extraction issue:', {
      node: props.node,
      children,
      extractedCode: codeStr,
      nodeData: props.node?.data,
      nodeValue: props.node?.value
    });
  }

  // 初始化 Mermaid（只在 mode 变化时执行）
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: mode === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
    });
  }, [mode]);

  // 渲染 Mermaid
  const renderMermaid = useCallback((container: HTMLDivElement, code: string) => {
    const renderId = `mermaid-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    mermaid.render(renderId, code)
      .then((result) => {
        if (container && result.svg) {
          container.innerHTML = result.svg;
        }
      })
      .catch((error) => {
        if (container) {
          container.innerHTML = `<pre style="color: red; padding: 10px;">Mermaid Error: ${error.message || String(error)}</pre>`;
        }
      });
  }, []);

  // 渲染 Mermaid
  useEffect(() => {
    if (!isMermaid || !codeStr || !containerRef.current) return;

    const container = containerRef.current;
    renderMermaid(container, codeStr);
  }, [codeStr, isMermaid, mode, renderMermaid]);

  // 全屏时也渲染一次
  useEffect(() => {
    if (isFullscreen && fullscreenRef.current && codeStr) {
      renderMermaid(fullscreenRef.current, codeStr);
    }
  }, [isFullscreen, codeStr, renderMermaid]);

  // 全屏切换
  const toggleFullscreen = () => {
    setIsFullscreen((current) => !current);
  };

  // 监听 ESC 键退出全屏
  useEffect(() => {
    if (!isFullscreen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  if (isMermaid) {
    return (
      <>
        <div className="relative group" style={{ minHeight: '100px' }}>
          <div ref={containerRef} className="mermaid-container" />
          {/* 全屏按钮 */}
          <button
            onClick={toggleFullscreen}
            className={`absolute top-2 right-2 p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-10 ${
              mode === 'dark'
                ? 'bg-slate-800/80 hover:bg-slate-700 text-gray-300 hover:text-white'
                : 'bg-white/80 hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
            title="全屏查看"
          >
            <Maximize2 size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* 全屏模态框 */}
        {isFullscreen && createPortal(
          <div
            className="fixed inset-0 z-[9999999] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Mermaid 图预览"
            style={{
              backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            }}
          >
            {/* 关闭按钮 */}
            <button
              onClick={toggleFullscreen}
              className={`absolute top-4 right-4 p-3 rounded-md z-50 ${
                mode === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-white hover:text-gray-100'
                  : 'bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
              title="退出全屏 (ESC)"
            >
              <X size={20} strokeWidth={1.75} />
            </button>

            {/* 缩放和拖动容器 */}
            <TransformWrapper
              initialScale={1}
              minScale={0.1}
              maxScale={Infinity}
              wheel={{ step: 0.1 }}
              doubleClick={{ disabled: true }}
              centerOnInit={true}
              limitToBounds={false}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* 缩放控制按钮 */}
                  <div className={`absolute bottom-4 -translate-x-50% flex gap-2 z-50 ${
                    mode === 'dark' ? 'bg-slate-800/80' : 'bg-white/80'
                  } rounded-md p-2`}>
                    <button
                      onClick={() => zoomIn()}
                      className={`p-2 rounded ${
                        mode === 'dark'
                          ? 'hover:bg-slate-700 text-gray-300'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                      title="放大"
                    >
                      <ZoomIn size={18} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => zoomOut()}
                      className={`p-2 rounded ${
                        mode === 'dark'
                          ? 'hover:bg-slate-700 text-gray-300'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                      title="缩小"
                    >
                      <ZoomOut size={18} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={() => resetTransform()}
                      className={`p-2 rounded ${
                        mode === 'dark'
                          ? 'hover:bg-slate-700 text-gray-300'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                      title="重置"
                    >
                      <Scan size={18} strokeWidth={1.75} />
                    </button>
                  </div>

                  <TransformComponent
                    wrapperStyle={{ width: '100%', height: '100%' }}
                    contentStyle={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px',
                    }}
                  >
                    <div
                      ref={fullscreenRef}
                      className="mermaid-container-fullscreen"
                      style={{
                        width: 'fit-content',
                        height: 'fit-content',
                        maxWidth: '100%',
                        maxHeight: '100%',
                      }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>, window.document.body
        )}
      </>
    );
  }

  return <code className={className}>{children}</code>;
});

MermaidCode.displayName = 'MermaidCode';

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(({
  document,
  onSave,
  onClose,
  isNew = false,
  isEditMode = false,
  onExitEditMode,
}, ref) => {
  const { mode } = useTheme();
  const repository = useLibraryRepository();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [frontMatter, setFrontMatter] = useState<FrontMatter>({
    title: "",
    // date 不在表单中显示，保存时会自动设置为当前日期
    excerpt: "",
    password: "",
    tags: [],
    readTime: undefined,
    coverImage: "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showFrontMatter, setShowFrontMatter] = useState(false);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => hasUnsavedChanges,
    hasPendingWrites: () => uploadingImages > 0 || saving,
  }), [hasUnsavedChanges, uploadingImages, saving]);

  // 预览模式的目录相关状态（必须在顶层声明）
  const [activeHeadingId, setActiveHeadingId] = useState<string>('');
  const lastScrollTopRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const originalDocumentRef = useRef<{ title: string; content: string; frontMatter: FrontMatter } | null>(null);

  // 目录折叠/展开状态，从 localStorage 恢复
  const [tocCollapsed, setTocCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('toc-collapsed');
      return saved === 'true';
    }
    return false;
  });

  // 保存目录状态到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('toc-collapsed', String(tocCollapsed));
    }
  }, [tocCollapsed]);

  // 检测内容变化
  useEffect(() => {
    if (!originalDocumentRef.current) {
      setHasUnsavedChanges(false);
      return;
    }

    const hasChanges =
      originalDocumentRef.current.title !== title ||
      originalDocumentRef.current.content !== content ||
      JSON.stringify(originalDocumentRef.current.frontMatter) !== JSON.stringify(frontMatter);

    setHasUnsavedChanges(hasChanges);
  }, [title, content, frontMatter]);

  // 浏览器关闭前的提醒
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未保存的修改，确定要离开吗？';
        return '您有未保存的修改，确定要离开吗？';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // 用于防抖的内容更新
  const contentUpdateRef = useRef<string>('');

  // 稳定的 previewOptions - 避免滚动时重新渲染
  const previewOptionsForEdit = useMemo(() => ({
    components: {
      code: MermaidCode,
      img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <RepositoryImage {...props} repository={repository} />
      ),
    },
  }), [repository]);

  // 稳定的 previewOptions for preview mode - 包含标题组件
  const previewOptionsForPreview = useMemo(() => ({
    components: {
      code: MermaidCode,
      img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <RepositoryImage {...props} repository={repository} />
      ),
      // 使用 memo 优化标题组件
      h1: memo(({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children || ''));
        const id = generateHeadingId(text);
        return <h1 id={id} {...props}>{children}</h1>;
      }),
      h2: memo(({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children || ''));
        const id = generateHeadingId(text);
        return <h2 id={id} {...props}>{children}</h2>;
      }),
      h3: memo(({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children || ''));
        const id = generateHeadingId(text);
        return <h3 id={id} {...props}>{children}</h3>;
      }),
      h4: memo(({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children || ''));
        const id = generateHeadingId(text);
        return <h4 id={id} {...props}>{children}</h4>;
      }),
      h5: memo(({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children || ''));
        const id = generateHeadingId(text);
        return <h5 id={id} {...props}>{children}</h5>;
      }),
      h6: memo(({ children, ...props }: any) => {
        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children || ''));
        const id = generateHeadingId(text);
        return <h6 id={id} {...props}>{children}</h6>;
      }),
    },
  }), [repository]);

  useEffect(() => {
    if (document) {
      setTitle(document.title);
      setContent(document.content);
      contentUpdateRef.current = document.content;
      // 解析 Front Matter
      const fm = document.frontMatter || {};
      const newFrontMatter = {
        title: fm.title || document.title,
        // date 不在表单中显示，但保留在 frontMatter 中用于读取（保存时会自动更新）
        date: fm.date,
        excerpt: fm.excerpt || "",
        password: fm.password || "",
        author: fm.author || "",
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        readTime: fm.readTime,
        coverImage: fm.coverImage || "",
      };
      setFrontMatter(newFrontMatter);
      setIsEditing(isEditMode);
      // 保存原始内容用于比较
      originalDocumentRef.current = {
        title: document.title,
        content: document.content,
        frontMatter: newFrontMatter,
      };
    } else if (isNew) {
      setTitle("");
      setContent("");
      contentUpdateRef.current = "";
      const newFrontMatter = {
        title: "",
        // date 不在表单中显示，保存时会自动设置为当前日期
        excerpt: "",
        password: "",
        author: "",
        tags: [],
        readTime: undefined,
        coverImage: "",
      };
      setFrontMatter(newFrontMatter);
      setIsEditing(true);
      // 新文档没有原始内容
      originalDocumentRef.current = null;
    } else {
      // 没有文档时，也显示编辑器但处于非编辑状态
      setTitle("");
      setContent("");
      contentUpdateRef.current = "";
      const newFrontMatter = {
        title: "",
        // date 不在表单中显示，保存时会自动设置为当前日期
        excerpt: "",
        password: "",
        author: "",
        tags: [],
        readTime: undefined,
        coverImage: "",
      };
      setFrontMatter(newFrontMatter);
      setIsEditing(false);
      // 没有文档时也没有原始内容
      originalDocumentRef.current = null;
    }
  }, [document, isNew, isEditMode]);

  const handleSave = useCallback(async (cb?: () => void) => {
    if (saving) return;
    if (uploadingImages > 0) {
      showToast.info("图片正在保存，请稍候");
      return;
    }

    if (!title.trim()) {
      showToast.error("请输入文档标题");
      return;
    }

    setSaving(true);
    try {
      // date 字段自动设置为当前日期（每次更新时）
      const finalFrontMatter: FrontMatter = {
        ...frontMatter,
        title: title.trim(),
        date: new Date().toISOString().split('T')[0], // 每次保存时自动更新为当前日期
      };
      await onSave(title.trim(), content, finalFrontMatter);
      // 保存成功后更新原始内容
      originalDocumentRef.current = {
        title: title.trim(),
        content: content,
        frontMatter: finalFrontMatter,
      };
      cb?.();
    } catch (error: any) {
      console.error("Failed to save document:", error);
    } finally {
      setSaving(false);
    }
  }, [saving, uploadingImages, title, frontMatter, onSave, content]);

  // 处理 CTRL + S 快捷键保存
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleSave]);

  const finishEditing = () => {
    if (document) {
      setIsEditing(false);
      // 如果有文档，取消时只退出编辑模式，不关闭文档（回到预览模式）
      onExitEditMode?.();
    } else {
      setIsEditing(false);
      onClose();
    }
  };

  // 如果没有文档且不在编辑状态，显示只读的编辑器界面
  const isReadOnly = !isEditing && !document;
  // 预览模式：有文档但不在编辑状态
  const isPreviewMode = document && !isEditing;

  // 提取标题（使用 useMemo 缓存，只在预览模式且内容变化时重新计算）
  const headings = useMemo(() => {
    if (!isPreviewMode) return [];
    const docContent = document?.content || '';
    return extractHeadings(docContent);
  }, [isPreviewMode, document?.content]);

  // 内容更新处理 - 直接更新，保持输入流畅
  // 对于大内容，MDEditor 内部已经做了优化
  const handleContentChange = useCallback((
    value: string | undefined,
    event?: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const newContent = value || '';
    const deletionEdit = handleOrderedListDeletion(
      contentUpdateRef.current,
      newContent,
      event?.currentTarget.selectionStart ?? newContent.length,
    );
    const nextContent = deletionEdit?.content ?? newContent;

    contentUpdateRef.current = nextContent;
    setContent(nextContent);

    if (deletionEdit && event) {
      const textarea = event.currentTarget;
      const textareaScrollTop = textarea.scrollTop;
      const scrollPositions: Array<{ element: HTMLElement; scrollTop: number }> = [];
      const trackedElements = new Set<HTMLElement>();
      const trackScrollPosition = (element: HTMLElement | null) => {
        if (!element || trackedElements.has(element)) return;
        trackedElements.add(element);
        scrollPositions.push({ element, scrollTop: element.scrollTop });
      };
      let parent = textarea.parentElement;

      while (parent) {
        if (parent.scrollHeight > parent.clientHeight) {
          trackScrollPosition(parent);
        }
        parent = parent.parentElement;
      }

      const editor = textarea.closest(".w-md-editor");
      editor?.querySelectorAll<HTMLElement>(
        ".w-md-editor-area, .w-md-editor-preview",
      ).forEach(trackScrollPosition);

      const restoreScrollPositions = () => {
        textarea.scrollTop = textareaScrollTop;
        scrollPositions.forEach(({ element, scrollTop }) => {
          element.scrollTop = scrollTop;
        });
      };

      requestAnimationFrame(() => {
        textarea.setSelectionRange(deletionEdit.cursor, deletionEdit.cursor);
        restoreScrollPositions();
        requestAnimationFrame(restoreScrollPositions);
      });
    }
  }, []);

  const handleEditorKeyDownCapture = useCallback((
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    const textarea = event.currentTarget;
    const edit = handleOrderedListEnter(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    if (!edit) return;

    event.preventDefault();
    event.stopPropagation();
    contentUpdateRef.current = edit.content;
    setContent(edit.content);

    requestAnimationFrame(() => {
      textarea.setSelectionRange(edit.cursor, edit.cursor);
    });
  }, []);

  const handleImagePaste = useCallback(async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (files.length === 0) return;

    event.preventDefault();

    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const markers = files.map(
      () => `![图片保存中](xylo-upload-${crypto.randomUUID()})`,
    );
    const leadingBreak =
      selectionStart > 0 && textarea.value[selectionStart - 1] !== "\n"
        ? "\n"
        : "";
    const trailingBreak =
      selectionEnd < textarea.value.length && textarea.value[selectionEnd] !== "\n"
        ? "\n"
        : "";
    const insertion = `${leadingBreak}${markers.join("\n")}${trailingBreak}`;
    const nextContent =
      textarea.value.slice(0, selectionStart) +
      insertion +
      textarea.value.slice(selectionEnd);

    contentUpdateRef.current = nextContent;
    setContent(nextContent);
    setUploadingImages((count) => count + files.length);

    requestAnimationFrame(() => {
      const cursor = selectionStart + insertion.length;
      textarea.setSelectionRange(cursor, cursor);
    });

    try {
      const results = await Promise.allSettled(
        files.map((file) => repository.saveImage(file)),
      );

      setContent((currentContent) => {
        let resolvedContent = currentContent;
        results.forEach((result, index) => {
          const replacement = result.status === "fulfilled"
            ? `![${imageAltText(files[index])}](${result.value})`
            : "";
          resolvedContent = resolvedContent.replace(markers[index], replacement);
        });
        contentUpdateRef.current = resolvedContent;
        return resolvedContent;
      });

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length === 0) {
        showToast.success(
          files.length === 1 ? "图片已插入" : `${files.length} 张图片已插入`,
        );
      } else {
        console.error("Failed to save pasted images:", failures);
        showToast.error(`${failures.length} 张图片保存失败`);
      }
    } finally {
      setUploadingImages((count) => Math.max(0, count - files.length));
    }
  }, [repository]);

  // 仅使用滚动事件触发，移除所有自动检测机制
  useEffect(() => {
    if (!isPreviewMode || headings.length === 0 || typeof window === 'undefined') {
      setActiveHeadingId('');
      return;
    }

    if (!contentRef.current) return;

    const container = contentRef.current;
    const domDocument = window.document;

    // 找到实际的滚动容器（MDEditor 的预览容器）
    const findScrollContainer = (): HTMLElement | null => {
      // 尝试多个可能的滚动容器
      const selectors = [
        '.w-md-editor-preview',
        '.w-md-editor-preview .wmde-markdown',
        '.wmde-markdown',
        '.w-md-editor',
      ];

      for (const selector of selectors) {
        const el = container.querySelector(selector) as HTMLElement | null;
        if (el && (el.scrollHeight > el.clientHeight || el === container)) {
          return el;
        }
      }

      return container;
    };

    const scrollContainer = findScrollContainer();
    if (!scrollContainer) return;

    // 查找所有标题元素并设置 ID
    const headingElements: Array<{ id: string; element: HTMLElement }> = [];

    const findHeadingElements = () => {
      // 检查滚动容器是否仍然存在
      if (!scrollContainer || !scrollContainer.parentNode) {
        headingElements.length = 0;
        return;
      }

      // 清空之前的元素
      headingElements.length = 0;

      // 记录已经匹配过的元素，避免重复匹配
      const matchedElements = new Set<HTMLElement>();

      try {
        headings.forEach(({ id, text }, index) => {
        // 先尝试通过 ID 查找
        let element = scrollContainer.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;

        // 如果找到了，检查是否已经被匹配过
        if (element && matchedElements.has(element)) {
          element = null; // 如果已经被匹配，清空，重新查找
        }

        // 如果没找到，尝试通过文本内容查找（用于处理 ID 未设置的情况）
        if (!element) {
          const allHeadings = Array.from(scrollContainer.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];

          // 精确匹配（跳过已匹配的元素）
          for (const heading of allHeadings) {
            if (matchedElements.has(heading)) continue;

            const headingText = heading.textContent?.trim();
            if (headingText === text) {
              element = heading;
              break;
            }
          }

          // 如果精确匹配失败，尝试模糊匹配（处理空格、换行等差异）
          if (!element) {
            const normalizedText = text.replace(/\s+/g, ' ').trim();
            for (const heading of allHeadings) {
              if (matchedElements.has(heading)) continue;

              const headingText = heading.textContent?.replace(/\s+/g, ' ').trim();
              if (headingText === normalizedText) {
                element = heading;
                break;
              }
            }
          }

          // 如果还是没找到，尝试按索引匹配（作为最后手段）
          if (!element && index < allHeadings.length) {
            // 检查标题级别是否匹配，并且未被匹配过
            const expectedLevel = headings[index].level;
            for (let i = index; i < allHeadings.length; i++) {
              const heading = allHeadings[i];
              if (matchedElements.has(heading)) continue;

              const actualLevel = parseInt(heading.tagName.charAt(1));
              if (actualLevel === expectedLevel) {
                element = heading;
                break;
              }
            }
          }

        // 设置 ID（检查元素是否仍在 DOM 中）
        if (element && element.parentNode && !element.id) {
          try {
            element.id = id;
          } catch (error) {
            // 如果元素在操作过程中被移除，忽略错误
            console.warn('[TOC] Failed to set heading ID during scroll:', error);
          }
        }
        }

        // 如果还是没找到，在整个 document 中查找
        if (!element) {
          const docElement = domDocument.getElementById(id);
          if (docElement && !matchedElements.has(docElement as HTMLElement)) {
            element = docElement as HTMLElement;
          }
        }

        if (element && element.parentNode) {
          try {
            // 确保元素有正确的 ID
            if (element.id !== id) {
              element.id = id;
            }

            // 标记为已匹配
            matchedElements.add(element);

            headingElements.push({ id, element });
          } catch (error) {
            // 如果元素在操作过程中被移除，忽略错误
            console.warn('[TOC] Failed to process heading element:', error);
          }
        }
      });
      } catch (error) {
        // 如果容器在操作过程中被移除，清空元素列表
        console.warn('[TOC] Failed to find heading elements:', error);
        headingElements.length = 0;
      }
    };

    // 延迟查找，确保 DOM 已渲染
    let handleScroll: (() => void) | null = null;

    const findTimer = setTimeout(() => {
      findHeadingElements();

      if (headingElements.length === 0) return;

      // 计算当前应该激活的标题（仅在滚动时触发）
      const updateActiveHeading = () => {
        if (headingElements.length === 0) return;

        // 检查滚动容器是否仍然存在
        if (!scrollContainer || !scrollContainer.parentNode) return;

        try {
          const scrollTop = scrollContainer.scrollTop;
          const containerRect = scrollContainer.getBoundingClientRect();
          const viewportTop = scrollTop + 24; // 视口顶部偏移，避免跳过标题

          // 计算所有标题的位置（过滤掉已被移除的元素）
          const headingPositions = headingElements
            .filter(({ element }) => element && element.parentNode) // 只处理仍在 DOM 中的元素
            .map(({ id, element }) => {
              try {
                const elementRect = element.getBoundingClientRect();
                const relativeTop = elementRect.top - containerRect.top + scrollTop;
                return { id, top: relativeTop, element };
              } catch {
                // 如果元素在操作过程中被移除，返回 null
                return null;
              }
            })
            .filter((pos): pos is { id: string; top: number; element: HTMLElement } => pos !== null)
            .sort((a, b) => a.top - b.top);

          // 如果没有有效的标题位置，直接返回
          if (headingPositions.length === 0) return;

          // 方向感知的步进更新，避免小滚动跳跃
          const direction = scrollTop >= lastScrollTopRef.current ? 'down' : 'up';
          lastScrollTopRef.current = scrollTop;
          const switchThreshold = 8;
          let currentIndex = headingPositions.findIndex(({ id }) => id === activeHeadingId);
          if (currentIndex === -1) currentIndex = 0;

          if (direction === 'down') {
            while (
              currentIndex < headingPositions.length - 1 &&
              viewportTop >= headingPositions[currentIndex + 1].top - switchThreshold
            ) {
              currentIndex += 1;
            }
          } else {
            while (
              currentIndex > 0 &&
              viewportTop < headingPositions[currentIndex].top - switchThreshold
            ) {
              currentIndex -= 1;
            }
          }

          const activeHeading = headingPositions[currentIndex];

          if (activeHeading && activeHeading.id !== activeHeadingId) {
            setActiveHeadingId(activeHeading.id);
          }
        } catch (error) {
          // 如果容器或元素在操作过程中被移除，忽略错误
          console.warn('[TOC] Failed to update active heading:', error);
        }
      };

      // 使用 rAF 在滚动时逐帧更新，避免跳过中间标题
      let ticking = false;
      handleScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          updateActiveHeading();
          ticking = false;
        });
      };

      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

      // 初始检查一次
      updateActiveHeading();
    }, 200);

    return () => {
      clearTimeout(findTimer);
      if (handleScroll && scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isPreviewMode, headings, activeHeadingId]);

  // 为标题添加 ID（在渲染后，只在预览模式生效，使用防抖减少执行频率）
  useEffect(() => {
    if (!isPreviewMode || headings.length === 0 || typeof window === 'undefined' || !window.document || typeof window.document.querySelectorAll !== 'function') return;
    if (!contentRef.current) return;

    // 使用 requestAnimationFrame 和防抖优化性能
    let rafId: number | null = null;
    let timer: NodeJS.Timeout | null = null;

    const updateHeadingIds = () => {
      try {
        // 在内容容器内查找标题元素
        const container = contentRef.current;
        // 检查容器是否存在且仍在 DOM 中
        if (!container || !container.parentNode) return;

        // 按层级分组标题，避免不同层级的标题文本相同导致匹配错误
        const headingsByLevel = headings.reduce((acc, heading) => {
          if (!acc[heading.level]) {
            acc[heading.level] = [];
          }
          acc[heading.level].push(heading);
          return acc;
        }, {} as Record<number, Array<{ level: number; text: string; id: string }>>);

        // 为每个层级的标题添加 ID
        Object.keys(headingsByLevel).forEach((levelStr) => {
          const level = parseInt(levelStr);
          const levelHeadings = headingsByLevel[level];
          // 在内容容器内查找标题元素
          const elements = Array.from(container.querySelectorAll(`h${level}`)) as HTMLElement[];

          // 使用索引匹配，因为标题顺序应该是一致的
          levelHeadings.forEach((heading, index) => {
            const element = elements[index];
            // 检查元素是否存在且仍在 DOM 中
            if (element && element.parentNode && !element.id) {
              try {
                // 验证文本是否匹配（允许一些差异，比如空格）
                const elementText = element.textContent?.trim() || '';
                const headingText = heading.text.trim();

                // 使用更宽松的匹配：移除所有空白字符后比较
                const normalizeText = (str: string) => str.replace(/\s+/g, '');
                const normalizedElementText = normalizeText(elementText);
                const normalizedHeadingText = normalizeText(headingText);

                // 如果文本匹配或索引有效，设置ID
                if (normalizedElementText === normalizedHeadingText || index < elements.length) {
                  // 再次检查元素是否仍在 DOM 中
                  if (element.parentNode) {
                    element.id = heading.id;
                  }
                }
              } catch (error) {
                // 如果元素在操作过程中被移除，忽略错误
                console.warn('[TOC] Failed to set heading ID:', error);
              }
            }
          });
        });
      } catch (error) {
        console.warn('Failed to add heading IDs:', error);
      }
    };

    // 使用 requestAnimationFrame 确保在下一帧执行，避免阻塞渲染
    rafId = requestAnimationFrame(() => {
      timer = setTimeout(updateHeadingIds, 300); // 延迟执行，减少频率
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (timer) clearTimeout(timer);
    };
  }, [isPreviewMode, headings]);

  // 点击标题时滚动到对应位置
  const handleHeadingClick = (id: string) => {
    if (typeof window === 'undefined' || !window.document || typeof window.document.getElementById !== 'function') return;
    if (!contentRef.current) return;

    try {
      // 首先在整个document中查找
      let element = window.document.getElementById(id);

      // 如果没找到，在内容容器内查找
      if (!element && contentRef.current) {
        element = contentRef.current.querySelector(`#${CSS.escape(id)}`) as HTMLElement;
      }

      // 如果还是没找到，尝试查找所有标题并匹配文本
      if (!element && contentRef.current) {
        const allHeadings = Array.from(contentRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[];
        // 从headings数组中找到对应的标题文本
        const heading = headings.find(h => h.id === id);
        if (heading) {
          const normalizeText = (str: string) => str.replace(/\s+/g, '');
          const foundElement = allHeadings.find(el => {
            const elText = normalizeText(el.textContent?.trim() || '');
            const headingText = normalizeText(heading.text.trim());
            return elText === headingText;
          });
          if (foundElement) {
            element = foundElement;
          }

          // 如果找到了，设置ID以便下次使用
          if (element && !element.id) {
            element.id = id;
          }
        }
      }

      if (element && contentRef.current) {
        // 获取滚动容器和目标元素的位置
        const container = contentRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // 计算目标元素相对于滚动容器的位置
        const scrollTop = container.scrollTop;
        const elementTop = elementRect.top - containerRect.top + scrollTop;

        // 滚动到目标位置（留出一些顶部间距）
        container.scrollTo({
          top: elementTop - 20, // 留出 20px 的顶部间距
          behavior: 'smooth'
        });

        setActiveHeadingId(id);

        // 调试日志（开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.log(`[TOC] Scrolled to heading: "${id}"`, { element, container, elementTop });
        }
      } else {
        // 调试日志（开发环境）
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[TOC] Heading element not found: "${id}"`, {
            headings: headings.map(h => ({ text: h.text, id: h.id })),
            contentRef: !!contentRef.current
          });
        }
      }
    } catch (error) {
      console.warn('Failed to scroll to heading:', id, error);
    }
  };

  // 如果是预览模式，使用 MDEditor 的预览功能
  if (isPreviewMode) {
    const fm = document.frontMatter || {};

    return (
      <div className="h-full w-full flex flex-col relative" style={{ minWidth: 0, minHeight: 0, backgroundColor: 'transparent' }}>
        {/* 预览内容 - 整体可滚动，右侧留出目录栏空间 */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto transition-all duration-300"
          style={{
            minHeight: 0,
            marginRight: headings.length > 0 && !tocCollapsed ? '288px' : '0'
          }}
        >
          <div
            className="p-4"
            style={{
              backgroundColor: 'transparent',
              paddingLeft: '10%',
              paddingRight: '10%',
            }}
          >
            {/* 封面图 - 展示在元数据最上面 */}
            {fm.coverImage && (
              <div className="mb-6 rounded-lg overflow-hidden">
                <img
                  src={fm.coverImage}
                  alt={document.title}
                  className="w-full h-auto max-h-64 object-cover"
                  onError={(e) => {
                    // 图片加载失败时隐藏
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* 标题 */}
            <div className="mb-4">
              <h1
                className="text-2xl font-bold"
                style={{
                  color: mode === 'dark' ? '#f9fafb' : '#111827'
                }}
              >
                {document.title}
              </h1>
            </div>

            {/* 元数据展示 */}
            <div
              className="flex flex-wrap items-center gap-4 text-sm mb-4"
              style={{
                color: mode === 'dark' ? '#9ca3af' : '#4b5563'
              }}
            >
              {fm.date && (
                <div className="flex items-center gap-1.5" style={{ color: 'inherit' }}>
                  <CalendarDays size={15} strokeWidth={1.75} />
                  <span style={{ color: 'inherit' }}>{fm.date}</span>
                </div>
              )}
              {fm.readTime && (
                <div className="flex items-center gap-1.5" style={{ color: 'inherit' }}>
                  <Clock3 size={15} strokeWidth={1.75} />
                  <span style={{ color: 'inherit' }}>{fm.readTime} 分钟</span>
                </div>
              )}
              {fm.tags && Array.isArray(fm.tags) && fm.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tags size={15} strokeWidth={1.75} />
                  <div className="flex flex-wrap gap-1.5">
                    {fm.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className={`px-2 py-0.5 text-xs rounded backdrop-blur-sm ${
                          mode === 'dark'
                            ? 'bg-slate-700/60 text-gray-300 border border-slate-600/50'
                            : 'bg-gray-200/80 text-gray-600 border border-gray-300/50'
                        }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 摘要 */}
            {fm.excerpt && (
              <div
                className={`mb-6 text-sm italic border-l-4 pl-3 ${
                  mode === 'dark' ? 'border-slate-600 text-gray-400' : 'border-gray-400 text-gray-600'
                }`}
              >
                {fm.excerpt}
              </div>
            )}

            {/* Markdown 内容预览 - 使用 MDEditor 的预览功能 */}
            <div
              className="markdown-preview-container w-full"
              data-color-mode={mode}
              style={{
                minHeight: '200px',
                height: 'auto',
                overflow: 'visible',
                display: 'block',
                position: 'relative',
                marginTop: '0',
                paddingTop: '0'
              }}
            >
              <MDEditor
                value={document.content || "*暂无内容*"}
                onChange={() => { }}
                preview="preview"
                hideToolbar={true}
                visibleDragbar={false}
                minHeight={200}
                height={undefined}
                enableScroll={false}
                previewOptions={previewOptionsForPreview}
                data-color-mode={mode}
              />
            </div>
          </div>
        </div>

        {/* 右侧固定目录栏 */}
        {headings.length > 0 && (
          <>
            {/* 折叠/展开按钮 */}
            <button
              onClick={() => setTocCollapsed(!tocCollapsed)}
              className={`tech-icon-button fixed top-1/2 -translate-y-1/2 z-30 h-10 w-8 ${
                tocCollapsed
                  ? 'right-0'
                  : 'right-64'
              }`}
              title={tocCollapsed ? '展开目录' : '折叠目录'}
              aria-label={tocCollapsed ? '展开目录' : '折叠目录'}
            >
              {tocCollapsed ? <PanelRightOpen size={16} strokeWidth={1.75} /> : <PanelRightClose size={16} strokeWidth={1.75} />}
            </button>

            {/* 目录组件 */}
            {!tocCollapsed && (
              <TableOfContents
                headings={headings}
                activeId={activeHeadingId}
                onHeadingClick={handleHeadingClick}
              />
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full flex flex-col"
      style={{ minWidth: 0, minHeight: 0, backgroundColor: "transparent" }}
    >
      {/* 工具栏 */}
      <div
        className="tech-viewer-toolbar border-b p-4 shrink-0 w-full overflow-y-auto max-h-[80vh]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isReadOnly ? "选择一个文档或点击新建文档开始..." : "文档标题..."
            }
            disabled={isReadOnly}
            className="tech-search min-w-0 flex-1 basis-48 px-3 py-2 border rounded-md text-sm font-semibold outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {!isReadOnly && (
            <div className="flex items-center justify-start gap-2">
              <IconButton
                onClick={() => setShowFrontMatter(!showFrontMatter)}
                title="文档属性"
                aria-pressed={showFrontMatter}
                aria-expanded={showFrontMatter}
              >
                <SlidersHorizontal strokeWidth={1.75} />
              </IconButton>
              <button
                onClick={() => handleSave(isNew ? undefined : finishEditing)}
                disabled={saving}
                className="tech-command-button flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium"
                title="保存文档"
              >
                {saving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} strokeWidth={1.75} />}
                {saving ? "保存中" : "完成"}
              </button>
            </div>
          )}
        </div>

        {/* Front Matter 表单 */}
        {!isReadOnly && showFrontMatter && (
          <DocumentMetadataEditor
            frontMatter={frontMatter}
            onChange={setFrontMatter}
          />
        )}
      </div>

      {/* 编辑器区域 */}
      <div
        className="flex-1 flex relative w-full"
        style={{ minHeight: 0, minWidth: 0, height: "100%" }}
      >
        <div className="w-full h-full" data-color-mode={mode}>
          <MDEditor
            value={content}
            onChange={handleContentChange}
            preview="live"
            visibleDragbar
            hideToolbar={isReadOnly}
            height="100%"
            enableScroll={true}
            previewOptions={previewOptionsForEdit}
            textareaProps={{
              placeholder: isReadOnly
                ? "从左侧选择一个文档开始编辑，或点击「新建文档」创建新文档"
                : "开始编写你的 Markdown 文档...",
              disabled: isReadOnly,
              spellCheck: false,
              autoComplete: "off",
              autoCorrect: "off",
              autoCapitalize: "off",
              onKeyDownCapture: handleEditorKeyDownCapture,
              onPaste: handleImagePaste,
            }}
            data-color-mode={mode}
          />
        </div>
      </div>
    </div>
  );
});
