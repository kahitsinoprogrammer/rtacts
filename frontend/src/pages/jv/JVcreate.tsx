import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Combobox } from "../../components/ui/combobox";

type LookupOption = {
  value: string;
  label: string;
  search_text: string;
};

type SupplierLookupOption = LookupOption & {
  contact_person: string;
};

type JournalVoucherLookupsResponse = {
  suppliers?: SupplierLookupOption[];
  accounts?: LookupOption[];
};

type JVItemForm = {
  accountId: string;
  dr: string;
  cr: string;
  vatType: string;
};

type JVFormValues = {
  supplierSearch: string;
  supplierId: string;
  supplierContactPerson: string;
  items: JVItemForm[];
};

const emptyItem = (): JVItemForm => ({
  accountId: "",
  dr: "",
  cr: "",
  vatType: "",
});

export default function JVcreate() {
  const [supplierOptions, setSupplierOptions] = useState<SupplierLookupOption[]>([]);
  const [accountOptions, setAccountOptions] = useState<LookupOption[]>([]);
  const [loadError, setLoadError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<JVFormValues>({
    defaultValues: {
      supplierSearch: "",
      supplierId: "",
      supplierContactPerson: "",
      items: [emptyItem()],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setLoadError("");

        const res = await fetch("http://localhost:8080/journal-vouchers/lookups", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load lookup data");
        }

        const data = (await res.json()) as JournalVoucherLookupsResponse;
        setSupplierOptions(Array.isArray(data.suppliers) ? data.suppliers : []);
        setAccountOptions(Array.isArray(data.accounts) ? data.accounts : []);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load lookup data",
        );
      }
    };

    void loadLookups();
  }, []);

  const selectedSupplierId = watch("supplierId");
  const supplierById = useMemo(
    () => new Map(supplierOptions.map((option) => [option.value, option])),
    [supplierOptions],
  );

  useEffect(() => {
    const selectedSupplier = supplierById.get(selectedSupplierId);
    if (!selectedSupplier) {
      setValue("supplierContactPerson", "", { shouldDirty: true });
      setValue("supplierSearch", "", { shouldDirty: true });
      return;
    }

    setValue("supplierContactPerson", selectedSupplier.contact_person, {
      shouldDirty: true,
    });
    setValue("supplierSearch", selectedSupplier.label, { shouldDirty: true });
  }, [selectedSupplierId, supplierById, setValue]);

  const onSubmit = async (values: JVFormValues) => {
    if (!values.supplierId) {
      alert("Please select a valid supplier from the list.");
      return;
    }

    const payload = {
      supplier_id: values.supplierId,
      items: values.items.map((item, index) => ({
        account_id: item.accountId ? Number(item.accountId) : null,
        debit: item.dr ? Number(item.dr) : 0,
        credit: item.cr ? Number(item.cr) : 0,
        vat_type_id: item.vatType || null,
        line_no: index + 1,
      })),
    };

    const res = await fetch("http://localhost:8080/journal-vouchers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
      supplierSearch: "",
      supplierId: "",
      supplierContactPerson: "",
      items: [emptyItem()],
    });
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Create Journal Voucher
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Select supplier and add journal voucher line items.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 px-6 py-6"
          >
            {loadError && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {loadError}
              </p>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Supplier
                </h3>
                <p className="text-xs text-slate-500">
                  Search and select supplier from the master list.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
                    Supplier
                  </label>
                  <div className="relative">
                    <Controller
                      control={control}
                      name="supplierId"
                      rules={{ required: "Supplier is required" }}
                      render={({ field }) => (
                        <Combobox
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          items={supplierOptions.map((option) => ({
                            value: option.value,
                            label: option.label,
                            searchText: option.search_text,
                          }))}
                          placeholder="Select supplier..."
                          searchPlaceholder="Search supplier..."
                          emptyText="No supplier found"
                        />
                      )}
                    />
                    {errors.supplierId && (
                      <p className="mt-1 text-xs text-rose-600">
                        {errors.supplierId.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    {...register("supplierContactPerson")}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-slate-900">Items</h3>
                <p className="text-xs text-slate-500">
                  Add account entries for this journal voucher.
                </p>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                      <div className="relative lg:col-span-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Account No / Name
                        </label>
                        <Controller
                          control={control}
                          name={`items.${index}.accountId` as const}
                          rules={{ required: "Account is required" }}
                          render={({ field }) => (
                            <Combobox
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              items={accountOptions.map((option) => ({
                                value: option.value,
                                label: option.label,
                                searchText: option.search_text,
                              }))}
                              placeholder="Select account no or name..."
                              searchPlaceholder="Search account no or name..."
                              emptyText="No account found"
                            />
                          )}
                        />
                        {errors.items?.[index]?.accountId && (
                          <p className="mt-1 text-xs text-rose-600">
                            {errors.items[index]?.accountId?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Dr
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          {...register(`items.${index}.dr` as const, {
                            required: "Dr is required",
                          })}
                        />
                        {errors.items?.[index]?.dr && (
                          <p className="mt-1 text-xs text-rose-600">
                            {errors.items[index]?.dr?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          Cr
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          {...register(`items.${index}.cr` as const, {
                            required: "Cr is required",
                          })}
                        />
                        {errors.items?.[index]?.cr && (
                          <p className="mt-1 text-xs text-rose-600">
                            {errors.items[index]?.cr?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700">
                          VAT Type
                        </label>
                        <select
                          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                          {...register(`items.${index}.vatType` as const, {
                            required: "VAT Type is required",
                          })}
                        >
                          <option value="">Select VAT type</option>
                          <option value="11111111-2222-3333-4444-555555555555">
                            VAT SAMPLE
                          </option>
                        </select>
                        {errors.items?.[index]?.vatType && (
                          <p className="mt-1 text-xs text-rose-600">
                            {errors.items[index]?.vatType?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                        className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => append(emptyItem())}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Add Item
                </button>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  reset({
                    supplierSearch: "",
                    supplierId: "",
                    supplierContactPerson: "",
                    items: [emptyItem()],
                  });
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Clear
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : "Create Journal Voucher"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
