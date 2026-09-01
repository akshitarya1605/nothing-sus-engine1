"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger" | "cyan";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-yellow text-ink",
  cyan: "bg-cyan text-ink",
  danger: "bg-red text-white",
  ghost: "bg-transparent text-fg border-line-strong",
};

const SIZE: Record<Size, string> = {
  sm: "text-sm px-3 py-2",
  md: "text-base px-5 py-3",
  lg: "text-lg px-7 py-4",
};

/** The chunky poster button — flat ink border + offset shadow that
 * collapses on press. Mirrors the landing's `.chunky-btn`. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", block, className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-pill border-[3px] border-ink font-display font-semibold uppercase tracking-wide",
        "shadow-pop transition-[transform,box-shadow] duration-150 ease-out",
        "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-pop-sm",
        "active:translate-x-[6px] active:translate-y-[6px] active:shadow-none",
        "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-pop-sm",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
});
