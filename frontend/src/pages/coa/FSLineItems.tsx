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

type AccountCategoryRow = {
  ID: number;
  Category?: string;
  AccountType?: number; // expected from API (filter key)
  IsActive: boolean;
};

type FormValues = {
  accountTypeId: string;
  accountCategoryId: string;
  fsLineAccountNo: string; // numeric only
  fsLineAccountName: string;
};

export default function FSLineTab() {
  const [types, setTypes] = React.useState<AccountTypeRow[]>([]);
  const [categories, setCategories] = React.useState<AccountCategoryRow[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(true);
  const [loadingCategories, setLoadingCategories] = React.useState(false);

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
      accountCategoryId: "",
      fsLineAccountNo: "",
      fsLineAccountName: "",
    },
  });

  const selectedAccountTypeId = watch("accountTypeId");
  const selectedAccountCategoryId = watch("accountCategoryId");
  const currentFsLineAccountNo = watch("fsLineAccountNo");

  // 1) Load account types
  React.useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch(
          "http://localhost:8080/chart-of-accounts/account-types",
          { method: "GET", credentials: "include" }
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

  // 2) When account type changes: reset category + fs_line no prefix
  React.useEffect(() => {
    setValue("accountCategoryId", "");
    setCategories([]);

    // enforce fsLineAccountNo first digit = first digit of accountTypeId
    const idNum = Number(selectedAccountTypeId);
    if (!Number.isFinite(idNum)) return;

    const firstDigit = String(idNum)[0];
    const existing = currentFsLineAccountNo ?? "";

    if (!existing) {
      setValue("fsLineAccountNo", firstDigit, { shouldValidate: true });
    } else {
      const rest = existing.slice(1);
      setValue("fsLineAccountNo", `${firstDigit}${rest}`, {
        shouldValidate: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountTypeId]);

  // 3) Load categories for selected account type
  React.useEffect(() => {
    if (!selectedAccountTypeId) return;

    let mounted = true;
    setLoadingCategories(true);

    (async () => {
      try {
        const res = await fetch(
          `http://localhost:8080/chart-of-accounts/account-categories?accountTypeId=${encodeURIComponent(
            selectedAccountTypeId
          )}`,
          { method: "GET", credentials: "include" }
        );

        if (!res.ok) {
          alert(`Error: ${res.status}`);
          return;
        }

        const data = (await res.json()) as AccountCategoryRow[];

        const activeOnly = (data ?? []).filter(
          (c) => (c as any).IsActive === true
        );

        if (mounted) setCategories(activeOnly);
      } catch (e) {
        alert(
          e instanceof Error ? e.message : "Failed to load account categories"
        );
      } finally {
        if (mounted) setLoadingCategories(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedAccountTypeId]);

  const onSubmit = async (values: FormValues) => {
    const data = {
      accountType: Number(values.accountTypeId),
      AccountGroup: Number(values.accountCategoryId),
      ID: values.fsLineAccountNo.trim(),
      fsAccountName: values.fsLineAccountName.trim(),
    };

    const res = await fetch(
      "http://localhost:8080/chart-of-accounts/fs-lines",
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );

    // ✅ fetch error message from backend: { error: "..." }
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
    reset({
      accountTypeId: "",
      accountCategoryId: "",
      fsLineAccountNo: "",
      fsLineAccountName: "",
    });
    setCategories([]);
  };


  return (
    <div className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Account Type */}
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

        {/* Account Type Category */}
        <OrdinarySelect
          label="Account Type Category"
          disabled={!selectedAccountTypeId || loadingCategories}
          placeholder={
            !selectedAccountTypeId
              ? "Select account type first"
              : loadingCategories
                ? "Loading..."
                : "Select category"
          }
          register={register("accountCategoryId", {
            required: "Account category is required",
          })}
          error={errors.accountCategoryId}
        >
          {categories.map((c) => {
            const label = (c.Category ?? "").toString();
            return (
              <option key={c.ID} value={String(c.ID)}>
                {c.ID} - {label ? label.toUpperCase() : "UNKNOWN"}
              </option>
            );
          })}
        </OrdinarySelect>
        
        <OrdinaryNumberInput
          label="Notes Line Item No. (numbers only)"
          placeholder="e.g., 10001"
          helperText="First digit auto-follows the selected account type ID."
          disabled={!selectedAccountCategoryId} // or whatever you use to enable this field
          register={register("fsLineAccountNo", {
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
          error={errors.fsLineAccountNo}
        />

        <OrdinaryInput
          label="FS Line Account Name"
          register={register("fsLineAccountName", {
            required: "FS line account name is required",
            validate: (v) =>
              v.trim().length > 0 || "FS line account name is required",
            maxLength: { value: 150, message: "Max 150 characters" },
          })}
          error={errors.fsLineAccountName}
        />

        <button
          type="submit"
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Create"}
        </button>
      </form>
    </div>
  );
}
