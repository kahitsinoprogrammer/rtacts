import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Select } from "./ui/select";
import { FormMessage } from "./ui/form-message";

interface OrdinarySelectProps {
  label?: string;
  register: UseFormRegisterReturn;
  error?: FieldError | string;

  disabled?: boolean;
  defaultValue?: string;

  placeholder?: string; // text shown for the disabled first option
  placeholderValue?: string; // usually ""
  className?: string;

  children: React.ReactNode; // your <option>...</option> list
}

export default function OrdinarySelect({
  label = "Select",
  register,
  error,
  disabled = false,
  defaultValue = "",
  placeholder = "Select an option",
  placeholderValue = "",
  className = "",
  children,
}: OrdinarySelectProps) {
  const errorMessage = typeof error === "string" ? error : error?.message;

  return (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-slate-700">
        {label}
      </label>

      <Select
        {...register}
        disabled={disabled}
        defaultValue={defaultValue}
        className={className}
      >
        <option value={placeholderValue} disabled>
          {placeholder}
        </option>

        {children}
      </Select>

      <FormMessage message={errorMessage} />
    </div>
  );
}
