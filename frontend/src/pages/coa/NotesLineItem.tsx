import React from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
import OrdinarySelect from "../../components/OrdinarySelect";
import OrdinaryNumberInput from "../../components/OrdinaryNumberInput";
type AccountTypeRow = {
  ID: number;
  Type?: string;
};

type AccountGroupRow = {
  ID: number;
  Category?: string;
  AccountType?: number;
};

type FSLineItemRow = {
  ID: number;
  AccountType?: number;
  AccountGroup?: number;
  FsAccountName?: string; // adjust if your API uses a different field name
};

type FormValues = {
  accountTypeId: string;
  accountGroupId: string;
  fsLineItemId: string;

  notesItemNo: string; // numeric only (textbox)
  notesItemName: string;
};

export default function NotesItemTab() {
  const [types, setTypes] = React.useState<AccountTypeRow[]>([]);
  const [groups, setGroups] = React.useState<AccountGroupRow[]>([]);
  const [fsLines, setFsLines] = React.useState<FSLineItemRow[]>([]);

  const [loadingTypes, setLoadingTypes] = React.useState(true);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [loadingFSLines, setLoadingFSLines] = React.useState(false);

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
      notesItemNo: "",
      notesItemName: "",
    },
  });

  const selectedAccountTypeId = watch("accountTypeId");
  const selectedAccountGroupId = watch("accountGroupId");
  const selectedFSLineItemId = watch("fsLineItemId");
  const currentNotesItemNo = watch("notesItemNo");

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
          ? data.filter((t) => (t as any).IsActive === true)
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

  // 2) When account type changes: reset downstream + set prefix for notesItemNo
  React.useEffect(() => {
    setValue("accountGroupId", "");
    setValue("fsLineItemId", "");
    setGroups([]);
    setFsLines([]);

    const idNum = Number(selectedAccountTypeId);
    if (!Number.isFinite(idNum)) return;

    const firstDigit = String(idNum)[0];
    const existing = currentNotesItemNo ?? "";

    if (!existing) {
      setValue("notesItemNo", firstDigit);
    } else {
      const rest = existing.slice(1);
      setValue("notesItemNo", `${firstDigit}${rest}`);
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

        const activeOnly = (data ?? []).filter(
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

  // 4) When account group changes: reset FS line dropdown, then load FS line items by type+group
  React.useEffect(() => {
    setValue("fsLineItemId", "");
    setFsLines([]);

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

        // optional client-side guard (in case backend returns broader set)
        const typeNum = Number(selectedAccountTypeId);
        const groupNum = Number(selectedAccountGroupId);

        const filteredByTypeGroup = (data ?? []).filter((r) => {
          const okType =
            (r as any).AccountType == null
              ? true
              : Number((r as any).AccountType) === typeNum;

          const okGroup =
            (r as any).AccountGroup == null
              ? true
              : Number((r as any).AccountGroup) === groupNum;

          return okType && okGroup;
        });

        // ✅ active-only safeguard
        const activeOnly = filteredByTypeGroup.filter(
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

 const onSubmit = async (values: FormValues) => {
   const payload = {
     accountType: Number(values.accountTypeId),
     accountGroup: Number(values.accountGroupId),
     fsAccount: Number(values.fsLineItemId),
     id: values.notesItemNo.trim(),
     notesDescription: values.notesItemName.trim(),
   };

   const res = await fetch(
     "http://localhost:8080/chart-of-accounts/notes-line-items",
     {
       method: "POST",
       credentials: "include",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(payload),
     },
   );

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
     notesItemNo: "",
     notesItemName: "",
   });
   setGroups([]);
   setFsLines([]);
 };


  return (
    <div className="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Account Type */}
        <OrdinarySelect
          label="Account Type"
          disabled={loadingTypes}
          defaultValue=""
          placeholder={loadingTypes ? "Loading..." : "Select account type"}
          placeholderValue=""
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

        {/* Account Group (Category) */}
        <OrdinarySelect
          label="Account Group (Category)"
          disabled={!selectedAccountTypeId || loadingGroups}
          defaultValue=""
          placeholder={
            !selectedAccountTypeId
              ? "Select account type first"
              : loadingGroups
                ? "Loading..."
                : "Select group"
          }
          placeholderValue=""
          register={register("accountGroupId", {
            required: "Account group is required",
          })}
          error={errors.accountGroupId}
        >
          {groups.map((g) => {
            const label = (g.Category ?? "").toString();
            return (
              <option key={g.ID} value={String(g.ID)}>
                {g.ID} - {label ? label.toUpperCase() : "UNKNOWN"}
              </option>
            );
          })}
        </OrdinarySelect>

        {/* FS Line Item */}
        <OrdinarySelect
          label="FS Line Item"
          disabled={
            !selectedAccountTypeId || !selectedAccountGroupId || loadingFSLines
          }
          defaultValue=""
          placeholder={
            !selectedAccountGroupId
              ? "Select account group first"
              : loadingFSLines
                ? "Loading..."
                : "Select FS line item"
          }
          placeholderValue=""
          register={register("fsLineItemId", {
            required: "FS line item is required",
          })}
          error={errors.fsLineItemId}
        >
          {fsLines.map((f) => {
            const label = (f.FsAccountName ?? "").toString();
            return (
              <option key={f.ID} value={String(f.ID)}>
                {f.ID} - {label ? label.toUpperCase() : "UNKNOWN"}
              </option>
            );
          })}
        </OrdinarySelect>

        {/* Notes Item No */}
        <OrdinaryNumberInput
          label="Notes Line Item No. (numbers only)"
          placeholder="e.g., 10001"
          helperText="First digit auto-follows the selected account type ID."
          disabled={!selectedFSLineItemId}
          register={register("notesItemNo", {
            required: "Notes item no is required",
            pattern: { value: /^[0-9]+$/, message: "Numbers only" },
            validate: (v) => {
              if (!selectedAccountTypeId) return true;
              const firstDigit = String(Number(selectedAccountTypeId))[0];
              return v?.[0] === firstDigit
                ? true
                : `Must start with ${firstDigit} (from account type)`;
            },
          })}
          error={errors.notesItemNo}
        />

        {/* Notes Item Name */}
        <OrdinaryInput
          label="Notes Line Item Name"
          register={register("notesItemName", {
            required: "Notes line item name is required",
            validate: (v) =>
              v.trim().length > 0 || "Notes line item name is required",
            maxLength: { value: 150, message: "Max 150 characters" },
          })}
          error={errors.notesItemName}
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
