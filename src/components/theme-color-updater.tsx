"use client";

import { useLayoutEffect } from "react";
import { useTheme } from "@/contexts/theme-context";

/**
 * 组件用于将主题颜色同步到 CSS 变量
 * 使用 useLayoutEffect 在浏览器绘制之前同步更新，减少闪烁
 */
export function ThemeColorUpdater() {
  const { mode } = useTheme();

  useLayoutEffect(() => {
    // 根据模式设置主题色
    const color = mode === "light" ? "#3b82f6" : "#60a5fa";
    // 更新根元素的 CSS 变量
    document.documentElement.style.setProperty(
      "--copilot-kit-primary-color",
      color
    );
  }, [mode]);

  return null;
}
