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
        className="mt-1 flex w-full items-center justify-between font-normal"
      >
        <span className={selectedItem ? "truncate" : "truncate text-slate-400"}>
          {selectedItem?.label || placeholder}
        </span>
        <span className="ml-2 text-xs text-slate-500">v</span>
      </Button>

      {open && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-300 bg-white shadow-lg">
          <div className="border-b border-slate-100 p-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="mt-0"
            />
          </div>

          {filteredItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
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
                  "block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0",
                  item.value === value
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-700 hover:bg-slate-50",
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
