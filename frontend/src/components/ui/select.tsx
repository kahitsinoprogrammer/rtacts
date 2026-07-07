import * as React from "react";
import { cn } from "../../lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "mt-1 flex h-11 w-full rounded-xl border border-[#c7d6e6] bg-white/95 px-3.5 py-2.5 text-sm text-[#16324f] outline-none ring-offset-white transition-all duration-200",
          "focus-visible:border-[#2a78ae] focus-visible:ring-4 focus-visible:ring-[#cfe2f2]",
          "disabled:cursor-not-allowed disabled:bg-[#eef4f9] disabled:text-[#8aa0b7]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

Select.displayName = "Select";
