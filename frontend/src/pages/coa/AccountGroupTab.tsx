import React from "react";
import { useForm } from "react-hook-form";
import OrdinarySelect from "../../components/OrdinarySelect";
import OrdinaryNumberInput from "../../components/OrdinaryNumberInput";
import OrdinaryInput from "../../components/OrdinaryInput";
type AccountTypeRow = {
  ID: number;
  Type?: string;
  IsActive: boolean;
};

type FormValues = {
  accountTypeId: string; // from <select>
  category: string;
  groupNumber: string; // numeric only (string so we can control prefix easily)
};

export default function AccountGroupTab() {
  const [types, setTypes] = React.useState<AccountTypeRow[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(true);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      accountTypeId: "",
      category: "",
      groupNumber: "",
    },
  });

  const selectedAccountTypeId = watch("accountTypeId");
  const currentGroupNumber = watch("groupNumber");

  // Load dropdown choices: coa_account_type
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch(
          "http://localhost:8080/chart-of-accounts/account-types",
          { method: "GET", credentials: "include" },
        );

        if (!res.ok) {
          alert(`Error: ${res.status}`);
          return;
        }

        const data = (await res.json()) as AccountTypeRow[];

        const activeOnly = Array.isArray(data)
          ? data.filter((t) => t.IsActive === true)
          : [];

        if (mounted) setTypes(activeOnly);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to load account types");
      } finally {
        if (mounted) setLoadingTypes(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // When account type changes, set the first digit of groupNumber to the first digit of the selected type id
  React.useEffect(() => {
    if (!selectedAccountTypeId) return;

    const idNum = Number(selectedAccountTypeId);
    if (!Number.isFinite(idNum)) return;

    const firstDigit = String(idNum)[0];
    const existing = currentGroupNumber ?? "";

    if (!existing) {
      setValue("groupNumber", firstDigit, { shouldValidate: true });
      return;
    }

    const rest = existing.slice(1);
    setValue("groupNumber", `${firstDigit}${rest}`, { shouldValidate: true });
  }, [selectedAccountTypeId]); // only on dropdown change

  const onSubmit = async (values: FormValues) => {
    try {
      const data = {
        accountType: Number(values.accountTypeId),
        category: values.category.trim(),
        ID: values.groupNumber.trim(),
      };

      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/account-groups",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );

      if (!res.ok) {
        let errMsg = "Invalid input";
        try {
          const errData = await res.json();
          errMsg = errData?.error || errMsg;
        } catch {}
        alert(errMsg);
        return;
      }

      alert("success");
      reset({ accountTypeId: "", category: "", groupNumber: "" });
    } catch (e: any) {
      // This catches CORS / network failures where there's NO status code
      alert(`Request failed: ${e?.message || "Network/CORS error"}`);
    }
  };

  return (
    <div className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        {/* Account Type Dropdown */}
        <OrdinarySelect
          label="Account Type"
          disabled={loadingTypes}
          placeholder={loadingTypes ? "Loading..." : "Select account type"}
          register={register("accountTypeId", {
            required: "Account type is required",
          })}
          error={errors.accountTypeId}
        >
          {types.map((t) => {
            const label = (t.Type ?? "").toString();
            return (
              <option key={t.ID} value={String(t.ID)}>
                {t.ID} - {label ? label.toUpperCase() : "UNKNOWN"}
              </option>
            );
          })}
        </OrdinarySelect>

        {/* Group Number (numbers only) */}
        <OrdinaryNumberInput
          label="Category Number (numbers only)"
          placeholder="e.g., 100"
          helperText="First digit auto-follows the selected account type ID."
          disabled={!selectedAccountTypeId}
          register={register("groupNumber", {
            required: "Please fill this up",
            pattern: { value: /^[0-9]+$/, message: "Numbers only" },
            validate: (v) => {
              if (!selectedAccountTypeId) return true;
              const firstDigit = String(Number(selectedAccountTypeId))[0];
              return v?.[0] === firstDigit
                ? true
                : `Must start with ${firstDigit} (from account type)`;
            },
          })}
          error={errors.groupNumber}
        />

        <OrdinaryInput
          label="Category"
          register={register("category", {
            required: "Category is required",
            validate: (v) => v.trim().length > 0 || "Category is required",
            maxLength: { value: 100, message: "Max 100 characters" },
          })}
          error={errors.category}
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
