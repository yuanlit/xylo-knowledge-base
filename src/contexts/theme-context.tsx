"use client";

import React, { createContext, useContext, useState, useCallback, useLayoutEffect, ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type ThemeColorPreset = "blue" | "purple" | "cyan" | "green" | "orange" | "pink";

export const THEME_COLORS: Record<ThemeColorPreset, { light: string; dark: string; gradient: string }> = {
  blue: {
    light: "#3b82f6",
    dark: "#60a5fa",
    gradient: "from-blue-500 to-cyan-500",
  },
  purple: {
    light: "#8b5cf6",
    dark: "#a78bfa",
    gradient: "from-purple-500 to-pink-500",
  },
  cyan: {
    light: "#06b6d4",
    dark: "#22d3ee",
    gradient: "from-cyan-500 to-blue-500",
  },
  green: {
    light: "#10b981",
    dark: "#34d399",
    gradient: "from-green-500 to-emerald-500",
  },
  orange: {
    light: "#f59e0b",
    dark: "#fbbf24",
    gradient: "from-orange-500 to-amber-500",
  },
  pink: {
    light: "#ec4899",
    dark: "#f472b6",
    gradient: "from-pink-500 to-rose-500",
  },
};

interface ThemeContextType {
  mode: ThemeMode;
  themeColor: ThemeColorPreset;
  setMode: (mode: ThemeMode) => void;
  setThemeColor: (color: ThemeColorPreset) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY_MODE = "theme-mode";
const STORAGE_KEY_COLOR = "theme-color";

// 安全地访问 localStorage
function getStoredValue(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Failed to read ${key} from localStorage:`, error);
    return null;
  }
}

// 安全地保存到 localStorage
function setStoredValue(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
  defaultColor?: ThemeColorPreset;
}

export function ThemeProvider({
  children,
  defaultMode = "light",
  defaultColor = "blue"
}: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = getStoredValue(STORAGE_KEY_MODE);
    return stored === "light" || stored === "dark" ? stored : defaultMode;
  });
  const [themeColor, setThemeColorState] = useState<ThemeColorPreset>(() => {
    const stored = getStoredValue(STORAGE_KEY_COLOR) as ThemeColorPreset | null;
    return stored && Object.hasOwn(THEME_COLORS, stored) ? stored : defaultColor;
  });

  // 使用 useLayoutEffect 在浏览器绘制之前同步更新，减少闪烁
  useLayoutEffect(() => {
    const html = document.documentElement;

    // 确保 dark 类正确应用
    if (mode === "dark") {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.remove("dark");
      html.classList.add("light");
    }

  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    setStoredValue(STORAGE_KEY_MODE, newMode);
    const html = document.documentElement;
    // 确保正确切换类
    if (newMode === "dark") {
      html.classList.add("dark");
      html.classList.remove("light");
    } else {
      html.classList.remove("dark");
      html.classList.add("light");
    }
  }, []);

  const setThemeColor = useCallback((color: ThemeColorPreset) => {
    setThemeColorState(color);
    setStoredValue(STORAGE_KEY_COLOR, color);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, themeColor, setMode, setThemeColor, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
