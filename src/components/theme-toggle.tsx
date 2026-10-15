"use client";

import { useTheme } from "@/contexts/theme-context";
import { IconButton } from "@/components/icon-button";
import { MoonStar, Sun } from "lucide-react";

export function ThemeToggle({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
  compact?: boolean;
}) {
  const { mode, toggleMode } = useTheme();

  return (
    <IconButton
      onClick={toggleMode}
      title={`切换到${mode === "light" ? "深色" : "浅色"}模式`}
      size={size}
    >
      {mode === "light" ? <MoonStar strokeWidth={1.75} /> : <Sun strokeWidth={1.75} />}
    </IconButton>
  );
}
