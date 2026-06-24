import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "./ui/input";
import { FormMessage } from "./ui/form-message";

interface OrdinaryNumberInputProps {
  label?: string;
  placeholder?: string;
  register: UseFormRegisterReturn;
  error?: FieldError | string;
  helperText?: string;
  disabled?: boolean;
  className?: string;

  /**
   * Optional: allow empty string while typing.
   * Still numeric-only (no letters/symbols).
   */
  allowEmpty?: boolean;
}

export default function OrdinaryNumberInput({
  label = "Number",
  placeholder = "e.g., 100",
  register,
  error,
  helperText,
  disabled = false,
  className = "",
  allowEmpty = true,
}: OrdinaryNumberInputProps) {
  const errorMessage = typeof error === "string" ? error : error?.message;

  return (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <Input
        inputMode="numeric"
        disabled={disabled}
        placeholder={placeholder}
        {...register}
        onInput={(e) => {
          const el = e.currentTarget;

          // keep only digits
          const next = el.value.replace(/\D/g, "");

          // optionally prevent empty
          el.value = allowEmpty ? next : next || "0";
        }}
        className={className}
      />

      <FormMessage message={errorMessage} />

      {helperText && (
        <p className="text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  );
}
