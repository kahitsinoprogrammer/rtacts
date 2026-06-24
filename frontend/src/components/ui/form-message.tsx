import { cn } from "../../lib/utils";

export function FormMessage({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return <div className="mt-1 h-4" />;
  return <p className={cn("mt-1 text-xs text-rose-600", className)}>{message}</p>;
}

export function FormAlert({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700",
        className,
      )}
      role="alert"
    >
      {message}
    </div>
  );
}
