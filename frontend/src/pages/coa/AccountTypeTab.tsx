import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
type FormValues = { accountType: string };

export default function AccountTypeTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { accountType: "" } });

  const onSubmit = async (values: FormValues) => {
    const data = { accountType: values.accountType.trim() };

    const res = await fetch(
      "http://localhost:8080/chart-of-accounts/account-types",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );

    if (!res.ok) {
      alert(`Error: ${res.status}`);
      return;
    }

    alert("success");
    reset({ accountType: "" });
  };

  return (
    <div className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <OrdinaryInput
          label="Account Type"
          register={register("accountType", {
            required: "Account type is required",
            validate: (v) => v.trim().length > 0 || "Account type is required",
            maxLength: { value: 100, message: "Max 100 characters" },
          })}
          error={errors.accountType}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Create"}
        </button>
      </form>
    </div>
  );
}
