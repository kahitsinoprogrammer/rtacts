import * as React from "react";
import { cn } from "../../lib/utils";

type DialogContextType = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextType | null>(null);

const useDialogContext = () => {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error("Dialog components must be used within Dialog.");
  }
  return ctx;
};

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  const { open } = useDialogContext();
  if (!open) return null;
  return <>{children}</>;
}

export function DialogOverlay({ className }: { className?: string }) {
  const { onOpenChange } = useDialogContext();
  return (
    <div
      className={cn("fixed inset-0 z-50 bg-[#102038]/38 backdrop-blur-[3px]", className)}
      onClick={() => onOpenChange(false)}
      aria-hidden="true"
    />
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { open } = useDialogContext();
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border border-[#d2dfeb] bg-white shadow-[0_28px_68px_rgba(16,32,56,0.22)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-[#e1eaf2] px-6 py-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className={cn("text-lg font-semibold text-[#16324f]", className)}>
      {children}
    </h2>
  );
}

export function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-[#e1eaf2] px-6 py-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DialogClose({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { onOpenChange } = useDialogContext();
  return (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      className={cn(
        "rounded-xl px-3 py-2 text-[#627991] transition-colors hover:bg-[#eef5fb]",
        className,
      )}
      aria-label="Close dialog"
    >
      {children ?? "Close"}
    </button>
  );
}
