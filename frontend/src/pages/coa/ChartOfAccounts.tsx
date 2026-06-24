import React from "react";
import { useForm } from "react-hook-form";
import OrdinarySelect from "../../components/OrdinarySelect";
import OrdinaryNumberInput from "../../components/OrdinaryNumberInput";
import OrdinaryInput from "../../components/OrdinaryInput";
type AccountTypeRow = { ID: number; Type?: string; IsActive:Boolean};
type AccountGroupRow = { ID: number; Category?: string; AccountType?: number };
type FSLineItemRow = {
  ID: number;
  AccountType?: number;
  AccountGroup?: number;
  FsAccountName?: string; // matches your current Go field (FsAccountName)
};
type NotesLineItemRow = {
  ID: number;
  AccountType?: number;
  AccountGroup?: number;
  FsLineItemId?: number;
  NotesDescription?: string; // adjust to whatever your API returns
};

type FormValues = {
  accountTypeId: string;
  accountGroupId: string;
  fsLineItemId: string;
  notesLineItemId: string;

  coaId: string; // numeric only
  coaItemName: string;
  description: string; // optional
};

export default function ChartOfAccountItemTab() {
  const [types, setTypes] = React.useState<AccountTypeRow[]>([]);
  const [groups, setGroups] = React.useState<AccountGroupRow[]>([]);
  const [fsLines, setFsLines] = React.useState<FSLineItemRow[]>([]);
  const [notesLines, setNotesLines] = React.useState<NotesLineItemRow[]>([]);

  const [loadingTypes, setLoadingTypes] = React.useState(true);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [loadingFSLines, setLoadingFSLines] = React.useState(false);
  const [loadingNotesLines, setLoadingNotesLines] = React.useState(false);

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
      accountGroupId: "",
      fsLineItemId: "",
      notesLineItemId: "",
      coaId: "",
      coaItemName: "",
      description: "",
    },
  });

  const selectedAccountTypeId = watch("accountTypeId");
  const selectedAccountGroupId = watch("accountGroupId");
  const selectedFSLineItemId = watch("fsLineItemId");
  const selectedNotesLineItemId = watch("notesLineItemId");
  const currentCoaId = watch("coaId");

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

      // ✅ keep only active rows
      const activeOnly = (data ?? []).filter((t) => t.IsActive === true);

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



  // 2) When account type changes: reset downstream + prefix coaId
  React.useEffect(() => {
    setValue("accountGroupId", "");
    setValue("fsLineItemId", "");
    setValue("notesLineItemId", "");
    setGroups([]);
    setFsLines([]);
    setNotesLines([]);

    const idNum = Number(selectedAccountTypeId);
    if (!Number.isFinite(idNum)) return;

    const firstDigit = String(idNum)[0];
    const existing = currentCoaId ?? "";

    if (!existing) {
      setValue("coaId", firstDigit, { shouldValidate: true });
    } else {
      const rest = existing.slice(1);
      setValue("coaId", `${firstDigit}${rest}`, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountTypeId]);

  // 3) Load account groups by account type
  React.useEffect(() => {
    if (!selectedAccountTypeId) return;

    let mounted = true;
    setLoadingGroups(true);

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

        const data = (await res.json()) as AccountGroupRow[];

        // fallback filter if backend returns all
        const typeNum = Number(selectedAccountTypeId);
        const filteredByType =
          data?.length && data[0]?.AccountType != null
            ? data.filter((g) => Number(g.AccountType) === typeNum)
            : data;

        // ✅ keep only active rows
        const activeOnly = (filteredByType ?? []).filter(
          (g) => (g as any).IsActive === true
        );

        if (mounted) setGroups(activeOnly);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to load account groups");
      } finally {
        if (mounted) setLoadingGroups(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [selectedAccountTypeId]);


  // 4) When account group changes: reset fs line + notes line, then load fs line items
React.useEffect(() => {
  setValue("fsLineItemId", "");
  setValue("notesLineItemId", "");
  setFsLines([]);
  setNotesLines([]);

  if (!selectedAccountTypeId || !selectedAccountGroupId) return;

  let mounted = true;
  setLoadingFSLines(true);

  (async () => {
    try {
      const res = await fetch(
        `http://localhost:8080/chart-of-accounts/fs-line-items?accountTypeId=${encodeURIComponent(
          selectedAccountTypeId
        )}&accountGroupId=${encodeURIComponent(selectedAccountGroupId)}`,
        { method: "GET", credentials: "include" }
      );

      if (!res.ok) {
        alert(`Error: ${res.status}`);
        return;
      }

      const data = (await res.json()) as FSLineItemRow[];

      // ✅ keep only active rows
      const activeOnly = (data ?? []).filter(
        (r) => (r as any).IsActive === true
      );

      if (mounted) setFsLines(activeOnly);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load FS line items");
    } finally {
      if (mounted) setLoadingFSLines(false);
    }
  })();

  return () => {
    mounted = false;
  };
}, [selectedAccountGroupId]);


  // 5) When fs line changes: reset notes line, then load notes line items (requires all 3)
React.useEffect(() => {
  setValue("notesLineItemId", "");
  setNotesLines([]);

  if (
    !selectedAccountTypeId ||
    !selectedAccountGroupId ||
    !selectedFSLineItemId
  )
    return;

  let mounted = true;
  setLoadingNotesLines(true);

  (async () => {
    try {
      const res = await fetch(
        `http://localhost:8080/chart-of-accounts/notes-line-items?accountTypeId=${encodeURIComponent(
          selectedAccountTypeId
        )}&accountGroupId=${encodeURIComponent(
          selectedAccountGroupId
        )}&fsAccount=${encodeURIComponent(selectedFSLineItemId)}`,
        { method: "GET", credentials: "include" }
      );

      if (!res.ok) {
        alert(`Error: ${res.status}`);
        return;
      }

      const data = (await res.json()) as NotesLineItemRow[];

      // ✅ keep only active rows
      const activeOnly = (data ?? []).filter(
        (r) => (r as any).IsActive === true
      );

      if (mounted) setNotesLines(activeOnly);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load notes line items");
    } finally {
      if (mounted) setLoadingNotesLines(false);
    }
  })();

  return () => {
    mounted = false;
  };
}, [selectedFSLineItemId]);


const onSubmit = async (values: FormValues) => {
  const payload = {
    AccountType: Number(values.accountTypeId),
    AccountGroup: Number(values.accountGroupId),
    FsLine: Number(values.fsLineItemId),
    NotesLine: Number(values.notesLineItemId),

    ID: values.coaId.trim(),
    AccountDescription: values.coaItemName.trim(),
    AccountLongDesc: values.description.trim(),
  };

  const res = await fetch("http://localhost:8080/chart-of-accounts/coa-items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // ✅ fetch backend error: { error: "..." }
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
    accountGroupId: "",
    fsLineItemId: "",
    notesLineItemId: "",
    coaId: "",
    coaItemName: "",
    description: "",
  });
  setGroups([]);
  setFsLines([]);
  setNotesLines([]);
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
          {types.map((t) => (
            <option key={t.ID} value={String(t.ID)}>
              {t.ID} - {(t.Type ?? "UNKNOWN").toString().toUpperCase()}
            </option>
          ))}
        </OrdinarySelect>

        {/* Account Group */}
        <OrdinarySelect
          label="Account Group (Category)"
          disabled={!selectedAccountTypeId || loadingGroups}
          placeholder={
            !selectedAccountTypeId
              ? "Select account type first"
              : loadingGroups
                ? "Loading..."
                : "Select group"
          }
          register={register("accountGroupId", {
            required: "Account group is required",
          })}
          error={errors.accountGroupId}
        >
          {groups.map((g) => (
            <option key={g.ID} value={String(g.ID)}>
              {g.ID} - {(g.Category ?? "UNKNOWN").toString().toUpperCase()}
            </option>
          ))}
        </OrdinarySelect>

        {/* FS Line Item */}
        <OrdinarySelect
          label="FS Line Item"
          disabled={!selectedAccountGroupId || loadingFSLines}
          placeholder={
            !selectedAccountGroupId
              ? "Select account group first"
              : loadingFSLines
                ? "Loading..."
                : "Select FS line item"
          }
          register={register("fsLineItemId", {
            required: "FS line item is required",
          })}
          error={errors.fsLineItemId}
        >
          {fsLines.map((f) => (
            <option key={f.ID} value={String(f.ID)}>
              {f.ID} - {(f.FsAccountName ?? "UNKNOWN").toString().toUpperCase()}
            </option>
          ))}
        </OrdinarySelect>

        {/* Notes Line Item */}
        <OrdinarySelect
          label="Notes Line Item"
          disabled={!selectedFSLineItemId || loadingNotesLines}
          placeholder={
            !selectedFSLineItemId
              ? "Select FS line item first"
              : loadingNotesLines
                ? "Loading..."
                : "Select notes line item"
          }
          register={register("notesLineItemId", {
            required: "Notes line item is required",
          })}
          error={errors.notesLineItemId}
        >
          {notesLines.map((n) => (
            <option key={n.ID} value={String(n.ID)}>
              {n.ID} -{" "}
              {(n.NotesDescription ?? "UNKNOWN").toString().toUpperCase()}
            </option>
          ))}
        </OrdinarySelect>

        <OrdinaryNumberInput
          label="Chart of Account ID (numbers only)"
          placeholder="e.g., 110001"
          helperText="First digit auto-follows the selected account type ID."
          disabled={!selectedNotesLineItemId}
          register={register("coaId", {
            required: "Chart of account ID is required",
            pattern: { value: /^[0-9]+$/, message: "Numbers only" },
            validate: (v) => {
              if (!selectedAccountTypeId) return true;

              const firstDigit = String(Number(selectedAccountTypeId))[0];
              return v?.[0] === firstDigit
                ? true
                : `Must start with ${firstDigit} (from account type)`;
            },
          })}
          error={errors.coaId}
        />

        {/* Item Name */}
        <OrdinaryInput
          label="Item Name (Chart of Account Item)"
          register={register("coaItemName", {
            required: "Item name is required",
            validate: (v) => v.trim().length > 0 || "Item name is required",
            maxLength: { value: 150, message: "Max 150 characters" },
          })}
          error={errors.coaItemName}
        />

        {/* Description (optional) */}
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Description (optional)
          </label>
          <textarea
            disabled={!selectedNotesLineItemId}
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
            placeholder="Write description here..."
            {...register("description", {
              maxLength: { value: 500, message: "Max 500 characters" },
            })}
          />
          {errors.description && (
            <p className="mt-1 text-xs text-rose-600">
              {errors.description.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !selectedNotesLineItemId}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Create"}
        </button>
      </form>
    </div>
  );
}
