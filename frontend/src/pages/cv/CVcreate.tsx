import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Combobox } from "../../components/ui/combobox";
type Supplier = {
  supplier_id: string;
  company_id: string;
  supplier_name: string;
  email: string;
  contact_person: string;
  phone: string;
  address: string;
  tax_id: string;
  status: string;
  notes: string;
  date_registered: string;
  date_updated: string;
};

type Customer = {
  customer_id: string;
  company_id: string;
  customer_name: string;
  email: string;
  contact_person: string;
  phone: string;
  address: string;
  tax_id: string;
  status: string;
  notes: string;
  date_registered: string;
  date_updated: string;
};

type CoaAccount = {
  ID: number;
  AccountDescription: string;
  AccountLongDesc: string;
};

type CVItemForm = {
  accountId: string;
  customerId: string;
  dr: string;
  cr: string;
  vatType: string;
};

type CVFormValues = {
  supplierSearch: string;
  supplierId: string;
  supplierContactPerson: string;
  items: CVItemForm[];
};

const emptyItem = (): CVItemForm => ({
  accountId: "",
  customerId: "",
  dr: "",
  cr: "",
  vatType: "",
});

const toStr = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

export default function CVcreate() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [loadError, setLoadError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<CVFormValues>({
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

        const [suppliersRes, customersRes, accountsRes] = await Promise.all([
          fetch("http://localhost:8080/suppliers", {
            method: "GET",
            credentials: "include",
          }),
          fetch("http://localhost:8080/customers", {
            method: "GET",
            credentials: "include",
          }),
          fetch("http://localhost:8080/chart-of-accounts/coa-items", {
            method: "GET",
            credentials: "include",
          }),
        ]);

        if (!suppliersRes.ok || !customersRes.ok || !accountsRes.ok) {
          throw new Error("Failed to load lookup data");
        }

        const suppliersData = await suppliersRes.json();
        const customersData = await customersRes.json();
        const accountsData = await accountsRes.json();

        const supplierList = Array.isArray(suppliersData)
          ? suppliersData
          : suppliersData?.data;
        const customerList = Array.isArray(customersData)
          ? customersData
          : customersData?.data;
        const accountList = Array.isArray(accountsData)
          ? accountsData
          : accountsData?.data;

        setSuppliers(Array.isArray(supplierList) ? supplierList : []);
        setCustomers(Array.isArray(customerList) ? customerList : []);
        setAccounts(Array.isArray(accountList) ? accountList : []);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load lookup data",
        );
      }
    };

    loadLookups();
  }, []);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => {
        const supplierId = toStr(supplier.supplier_id);
        const supplierEmail = toStr(supplier.email);
        const supplierName = toStr(supplier.supplier_name);
        const supplierContactPerson = toStr(supplier.contact_person);
        const label = supplierEmail
          ? `${supplierName} (${supplierEmail})`
          : supplierName;

        return {
          id: supplierId,
          label,
          searchText: `${supplierName} ${supplierEmail}`.toLowerCase(),
          contact_person: supplierContactPerson,
        };
      }),
    [suppliers],
  );

  const selectedSupplierId = watch("supplierId");
  const supplierById = useMemo(
    () => new Map(supplierOptions.map((option) => [option.id, option])),
    [supplierOptions],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((account) => {
        const accountId = toStr(account.ID);
        const accountName = toStr(account.AccountDescription);
        const accountLongDesc = toStr(account.AccountLongDesc);
        const label = accountLongDesc
          ? `${accountName} - ${accountLongDesc}`
          : accountName;

        return {
          id: accountId,
          label,
          searchText: `${accountName} ${accountLongDesc} ${accountId}`.toLowerCase(),
        };
      }),
    [accounts],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => {
        const customerId = toStr(customer.customer_id);
        const customerName = toStr(customer.customer_name);
        const customerEmail = toStr(customer.email);
        const label = customerEmail
          ? `${customerName} (${customerEmail})`
          : customerName;

        return {
          id: customerId,
          label,
          searchText: `${customerName} ${customerEmail}`.toLowerCase(),
        };
      }),
    [customers],
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

  const onSubmit = async (values: CVFormValues) => {
    if (!values.supplierId) {
      alert("Please select a valid supplier from the list.");
      return;
    }

    const selectedSupplier = suppliers.find(
      (supplier) => toStr(supplier.supplier_id) === values.supplierId,
    );

    if (!selectedSupplier?.company_id) {
      alert("Selected supplier is missing company information.");
      return;
    }

    const payload = {
      supplier_id: values.supplierId,
      company_id: toStr(selectedSupplier.company_id),
      items: values.items.map((item, index) => ({
        account_id: item.accountId ? Number(item.accountId) : null,
        customer_id: item.customerId || null,
        debit: item.dr ? Number(item.dr) : 0,
        credit: item.cr ? Number(item.cr) : 0,
        vat_type_id: item.vatType || null,
        line_no: index + 1,
      })),
    };

    const res = await fetch("http://localhost:8080/check-vouchers", {
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
              Create Check Voucher
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Select supplier and add check voucher line items.
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
                            value: option.id,
                            label: option.label,
                            searchText: option.searchText,
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
                  Add account entries for this check voucher.
                </p>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
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
                                value: option.id,
                                label: option.label,
                                searchText: option.searchText,
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
                          Customer
                        </label>
                        <Controller
                          control={control}
                          name={`items.${index}.customerId` as const}
                          rules={{ required: "Customer is required" }}
                          render={({ field }) => (
                            <Combobox
                              value={field.value || ""}
                              onValueChange={field.onChange}
                              items={customerOptions.map((option) => ({
                                value: option.id,
                                label: option.label,
                                searchText: option.searchText,
                              }))}
                              placeholder="Select customer..."
                              searchPlaceholder="Search customer..."
                              emptyText="No customer found"
                            />
                          )}
                        />
                        {errors.items?.[index]?.customerId && (
                          <p className="mt-1 text-xs text-rose-600">
                            {errors.items[index]?.customerId?.message}
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
                {isSubmitting ? "Saving..." : "Create Check Voucher"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

