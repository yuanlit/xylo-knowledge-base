"use client";

import React, { ReactNode, ReactElement } from "react";

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title"> {
  title: string;
  children: ReactNode;
  className?: string;
  animationClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function IconButton({ onClick, title, children, className = "", animationClassName = "", size = "md", ...props }: IconButtonProps) {
  const sizeClasses = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10"
  };

  const iconSizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5"
  };

  return (
    <button
      type="button"
      {...props}
      onClick={onClick}
      className={`tech-icon-button ${sizeClasses[size]} ${className} ${animationClassName}`}
      title={title}
      aria-label={props["aria-label"] || title}
      style={{ aspectRatio: '1 / 1' }}
    >
      {React.isValidElement<{ className?: string }>(children)
        ? React.cloneElement(children as ReactElement<{ className?: string }>, {
            className: `${iconSizeClasses[size]} shrink-0 ${(children as ReactElement<{ className?: string }>).props.className || ''}`
          })
        : children
      }
    </button>
  );
}
