import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "./ui/input";
import { FormMessage } from "./ui/form-message";

interface OrdinaryInput {
  label?: string;
  register: UseFormRegisterReturn;
  error?: FieldError | string;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function OrdinaryInput({
  label = "Username",
  register,
  error,
  type = "text",
  placeholder,
  disabled = false,
  className = "",
}: OrdinaryInput) {
  const errorMessage = typeof error === "string" ? error : error?.message;

  return (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <Input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        {...register}
        className={className}
      />

      <FormMessage message={errorMessage} />
    </div>
  );
}
