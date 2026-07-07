import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "outline" | "ghost" | "destructive";
type Size = "default" | "sm" | "lg";

const variantClasses: Record<Variant, string> = {
  default:
    "border border-[#1b578f] bg-[linear-gradient(135deg,#1f669f,#163b66)] text-white shadow-[0_12px_28px_rgba(22,59,102,0.18)] hover:brightness-105",
  outline:
    "border border-[#c7d6e6] bg-white/95 text-[#26415f] hover:bg-[#f5f9fc]",
  ghost: "text-[#4c6179] hover:bg-[#edf4fa]",
  destructive: "bg-rose-600 text-white hover:bg-rose-700",
};

const sizeClasses: Record<Size, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 px-3",
  lg: "h-11 px-6",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200",
          "disabled:pointer-events-none disabled:opacity-60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9d3e9]",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
