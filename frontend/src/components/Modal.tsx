import React from "react";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "./ui/dialog";

type ModalProps = {
  isOpen: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
};

export function Modal({
  isOpen,
  title,
  onClose,
  children,
  footer,
  maxWidthClass = "max-w-lg",
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className={`mx-4 ${maxWidthClass}`}>
          <DialogHeader>
            <DialogTitle>{title ?? "Modal"}</DialogTitle>
            <DialogClose>x</DialogClose>
          </DialogHeader>

          <DialogBody>{children}</DialogBody>

          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
