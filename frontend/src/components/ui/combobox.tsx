import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";

export type ComboboxItem = {
  value: string;
  label: string;
  searchText?: string;
};

type ComboboxProps = {
  items: ComboboxItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
};

export function Combobox({
  items,
  value,
  onValueChange,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  emptyText = "No item found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = normalizedQuery
    ? items.filter((item) =>
        (item.searchText || item.label).toLowerCase().includes(normalizedQuery),
      )
    : items;
  const selectedItem = items.find((item) => item.value === value) || null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="mt-1 flex h-11 w-full items-center justify-between rounded-xl border-[#c7d6e6] px-3.5 font-normal"
      >
        <span className={selectedItem ? "truncate" : "truncate text-[#8aa0b7]"}>
          {selectedItem?.label || placeholder}
        </span>
        <svg
          className={cn(
            "ml-2 h-4 w-4 text-[#627991] transition-transform duration-200",
            open && "rotate-90",
          )}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 4l6 6l-6 6" />
        </svg>
      </Button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-[#c7d6e6] bg-white shadow-[0_22px_48px_rgba(22,50,79,0.18)]">
          <div className="border-b border-[#e2ebf3] p-3">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="mt-0"
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#6f8297]">{emptyText}</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  onValueChange(item.value === value ? "" : item.value);
                  setQuery("");
                  setOpen(false);
                }}
                className={cn(
                  "block w-full border-b border-[#edf3f8] px-4 py-3 text-left text-sm transition-colors last:border-b-0",
                  item.value === value
                    ? "bg-[#eef5fb] text-[#16324f]"
                    : "text-[#46607c] hover:bg-[#f5f9fc]",
                )}
              >
                {item.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
