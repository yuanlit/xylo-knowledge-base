"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "@/contexts/theme-context";
import { ListTree, ChevronRight } from "lucide-react";

// 树形节点类型
interface HeadingNode {
  level: number;
  text: string;
  id: string;
  children: HeadingNode[];
}

// 目录组件 Props
export interface TableOfContentsProps {
  headings: Array<{ level: number; text: string; id: string }>;
  activeId: string;
  onHeadingClick: (id: string) => void;
}

// 将扁平标题列表转换为树形结构
const buildHeadingTree = (headings: Array<{ level: number; text: string; id: string }>): HeadingNode[] => {
  if (headings.length === 0) return [];

  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = []; // 用于跟踪当前路径

  headings.forEach((heading) => {
    const node: HeadingNode = {
      level: heading.level,
      text: heading.text,
      id: heading.id,
      children: [],
    };

    // 找到合适的父节点
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // 根节点
      root.push(node);
    } else {
      // 添加到父节点的子节点列表
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return root;
};

// 扁平化树形结构（只包含展开的节点）
const flattenNodes = (nodes: HeadingNode[], expandedIds: Set<string>, result: Array<{ node: HeadingNode; depth: number }> = [], depth = 0): Array<{ node: HeadingNode; depth: number }> => {
  nodes.forEach(node => {
    result.push({ node, depth });
    if (node.children.length > 0 && expandedIds.has(node.id)) {
      flattenNodes(node.children, expandedIds, result, depth + 1);
    }
  });
  return result;
};

export function TableOfContents({
  headings,
  activeId,
  onHeadingClick,
}: TableOfContentsProps) {
  const { mode } = useTheme();
  const lineIndent = 10;
  const lineOffset = 8;
  const highlightSegment = 14;
  const lineStub = 16;
  const lineStubHalf = lineStub / 2;

  // 构建树形结构
  const tree = useMemo(() => buildHeadingTree(headings), [headings]);

  // 计算初始展开状态：默认展开所有有子节点的节点
  const initialExpandedIds = useMemo(() => {
    const expanded = new Set<string>();
    const traverse = (nodes: HeadingNode[]) => {
      nodes.forEach((node) => {
        if (node.children.length > 0) {
          expanded.add(node.id);
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    return expanded;
  }, [tree]);

  const [expansion, setExpansion] = useState({ tree, activeId: "", ids: initialExpandedIds });
  if (expansion.tree !== tree || expansion.activeId !== activeId) {
    const ids = new Set(expansion.tree !== tree ? initialExpandedIds : expansion.ids);
    const findPathToNode = (nodes: HeadingNode[], targetId: string, path: HeadingNode[] = []): HeadingNode[] | null => {
      for (const node of nodes) {
        const currentPath = [...path, node];
        if (node.id === targetId) {
          return currentPath;
        }
        if (node.children.length > 0) {
          const found = findPathToNode(node.children, targetId, currentPath);
          if (found) return found;
        }
      }
      return null;
    };

    const path = findPathToNode(tree, activeId);
    path?.slice(0, -1).forEach((node) => ids.add(node.id));
    setExpansion({ tree, activeId, ids });
  }
  const expandedIds = expansion.ids;

  // 切换折叠/展开状态
  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setExpansion((prev) => {
      const next = new Set(prev.ids);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...prev, ids: next };
    });
  };

  // 使用 ref 跟踪所有菜单项，用于计算指示器位置
  const menuItemRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // 当 activeId 改变时，自动滚动到对应的菜单项
  useEffect(() => {
    if (!activeId || !menuContainerRef.current) return;
    const menuItem = menuItemRefs.current.get(activeId);
    if (menuItem && menuContainerRef.current) {
      // 使用 setTimeout 确保 DOM 已更新
      setTimeout(() => {
        const container = menuContainerRef.current;
        const item = menuItem;
        if (container && item) {
          const containerRect = container.getBoundingClientRect();
          const itemRect = item.getBoundingClientRect();

          // 如果菜单项不在可视区域内，则滚动
          if (itemRect.top < containerRect.top || itemRect.bottom > containerRect.bottom) {
            item.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }
      }, 150);
    }
  }, [activeId]);

  // 扁平化节点列表（用于渲染）
  const flatNodes = useMemo(() => flattenNodes(tree, expandedIds), [tree, expandedIds]);

  // 单根折线连接所有节点
  const [tocPath, setTocPath] = useState<string>("");
  const [tocViewport, setTocViewport] = useState<{ width: number; height: number } | null>(null);
  const [tocPointMap, setTocPointMap] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!navRef.current) return;

    const updatePath = () => {
      const nav = navRef.current;
      if (!nav) return;

      const navRect = nav.getBoundingClientRect();
      const width = nav.clientWidth;
      const height = nav.scrollHeight;

      setTocViewport({ width, height });
      const points: Array<{ id: string; x: number; y: number }> = [];

      flatNodes.forEach(({ node, depth }) => {
        const item = menuItemRefs.current.get(node.id);
        if (!item) return;
        const itemRect = item.getBoundingClientRect();
        const x = lineOffset + depth * lineIndent;
        const y = itemRect.top - navRect.top + nav.scrollTop + itemRect.height / 2;
        points.push({ id: node.id, x, y });
      });

      if (points.length === 0) {
        setTocPath("");
        return;
      }

      let path = `M ${points[0].x} ${points[0].y - lineStubHalf} L ${points[0].x} ${points[0].y + lineStubHalf}`;
      for (let i = 1; i < points.length; i++) {
        const curr = points[i];
        path += ` L ${curr.x} ${curr.y - lineStubHalf} L ${curr.x} ${curr.y + lineStubHalf}`;
      }

      setTocPath(path);
      setTocPointMap(new Map(points.map((p) => [p.id, { x: p.x, y: p.y }])));
    };

    const rafId = requestAnimationFrame(() => {
      updatePath();
    });

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [flatNodes, expandedIds, lineStubHalf]);

  if (headings.length === 0) return null;

  return (
    <div
      ref={menuContainerRef}
      className="tech-toc fixed top-0 h-full w-64 overflow-y-auto border-l transition-all duration-300"
      style={{
        zIndex: 20,
        right: 0,
        boxShadow: mode === 'dark'
          ? '-4px 0 24px rgba(0,0,0,0.3)'
          : '-4px 0 24px rgba(0,0,0,0.08)'
      }}
    >
      <div className="p-4 pt-12 pb-2 relative">
        <h3 className={`text-sm font-semibold mb-4 pb-2 border-b flex items-center gap-1.5 ${
          mode === 'dark'
            ? 'text-gray-200 border-slate-700/60'
            : 'text-gray-700 border-gray-200/60'
        }`}>
          <ListTree size={16} strokeWidth={1.75} />
          目录
        </h3>

        <div className="relative min-h-0 text-sm overflow-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <nav ref={navRef} className="flex flex-col relative py-3">
            {/* 单根折线连接所有节点 */}
            {tocPath && tocViewport && (
              <svg
                className="absolute left-0 top-0 pointer-events-none"
                width={tocViewport.width}
                height={tocViewport.height}
                viewBox={`0 0 ${tocViewport.width} ${tocViewport.height}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d={tocPath}
                  className={mode === "dark" ? "stroke-gray-700/50" : "stroke-gray-300/50"}
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                {activeId && (() => {
                  const activeIndex = flatNodes.findIndex(({ node }) => node.id === activeId);
                  if (activeIndex === -1) return null;
                  const activePoint = tocPointMap.get(activeId);
                  if (!activePoint) return null;
                  const prevNode = activeIndex > 0 ? flatNodes[activeIndex - 1].node : null;
                  const prevPoint = prevNode ? tocPointMap.get(prevNode.id) : null;
                  if (!prevPoint) {
                    const x = activePoint.x;
                    const bottom = activePoint.y + lineStubHalf;
                    const segLen = Math.min(highlightSegment, lineStub);
                    const startY = bottom - segLen;
                    return (
                      <path
                        d={`M ${x} ${startY} L ${x} ${bottom}`}
                        className="tech-toc-active-line"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    );
                  }
                  const prevBottom = { x: prevPoint.x, y: prevPoint.y + lineStubHalf };
                  const currTop = { x: activePoint.x, y: activePoint.y - lineStubHalf };
                  const currBottom = { x: activePoint.x, y: activePoint.y + lineStubHalf };
                  const dx = currTop.x - prevBottom.x;
                  const dy = currTop.y - prevBottom.y;
                  const diagLen = Math.hypot(dx, dy);
                  const stubLen = lineStub;
                  const totalLen = diagLen + stubLen;
                  const isStraight = Math.abs(dx) < 0.5;
                  const segmentScale = isStraight ? 1 : 3;
                  const segmentLen = Math.min(highlightSegment * segmentScale, totalLen);
                  const remaining = Math.max(0, segmentLen - stubLen);
                  const ux = diagLen === 0 ? 0 : dx / diagLen;
                  const uy = diagLen === 0 ? 0 : dy / diagLen;
                  const diagStart = remaining >= diagLen
                    ? { x: prevBottom.x, y: prevBottom.y }
                    : { x: currTop.x - ux * remaining, y: currTop.y - uy * remaining };
                  return (
                    <>
                      <path
                        d={`M ${diagStart.x} ${diagStart.y} L ${currTop.x} ${currTop.y} L ${currBottom.x} ${currBottom.y}`}
                        className="tech-toc-active-line"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                      />
                    </>
                  );
                })()}
              </svg>
            )}

            {flatNodes.map(({ node, depth }) => {
              const hasChildren = node.children.length > 0;
              const isExpanded = expandedIds.has(node.id);
              const isActive = node.id === activeId;

              return (
                <a
                  key={node.id}
                  ref={(el) => {
                    if (el) {
                      menuItemRefs.current.set(node.id, el);
                    } else {
                      menuItemRefs.current.delete(node.id);
                    }
                  }}
                  href={`#${node.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onHeadingClick(node.id);
                  }}
                  data-active={isActive}
                  className="tech-toc-link relative py-1.5 text-sm transition-colors"
                  style={{
                    paddingLeft: `${lineOffset + depth * lineIndent + 12}px`,
                    fontSize: node.level === 1 ? '0.875rem' : node.level === 2 ? '0.8125rem' : '0.75rem'
                  }}
                  title={node.text}
                >
                  {/* 折叠/展开按钮 */}
                  {hasChildren && (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(node.id, e)}
                      aria-label={isExpanded ? `折叠${node.text}` : `展开${node.text}`}
                      aria-expanded={isExpanded}
                      title={isExpanded ? "折叠章节" : "展开章节"}
                      className={`absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center z-20 ${
                        mode === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <ChevronRight size={12} strokeWidth={1.75} className="tree-chevron" data-expanded={isExpanded} />
                    </button>
                  )}

                  <span className="wrap-anywhere relative z-10">{node.text}</span>
                </a>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
