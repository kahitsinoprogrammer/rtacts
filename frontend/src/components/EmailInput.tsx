import type { FieldError, UseFormRegisterReturn } from "react-hook-form";
import { Input } from "./ui/input";
import { FormMessage } from "./ui/form-message";

interface EmailInputProps {
  label?: string;
  register: UseFormRegisterReturn;
  error?: FieldError | string;
}

export default function EmailInput({
  label = "Email",
  register,
  error,
}: EmailInputProps) {
  const errorMessage = typeof error === "string" ? error : error?.message;

  return (
    <div className="flex flex-col">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <Input type="email" {...register} />
      <FormMessage message={errorMessage} />
    </div>
  );
}
