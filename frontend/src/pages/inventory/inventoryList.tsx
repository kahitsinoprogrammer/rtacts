
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
import { Combobox } from "../../components/ui/combobox";

type CoaAccount = {
  ID: number;
  AccountDescription: string;
  AccountLongDesc: string;
};

type Inventory = {
  id?: number | string | null;
  ID?: number | string | null;
  product_code?: string;
  product_name?: string | null;
  unit_measurement?: string | null;
  cost_per_unit?: number | string | null;
  account_number?: string | number | null;
  coa?: {
    AccountDescription?: string | null;
    account_description?: string | null;
    ID?: string | number | null;
    id?: string | number | null;
  } | null;
};

type InventoryFormValues = {
  productName: string;
  unitMeasurement: string;
  costPerUnit: string;
  accountNumber: string;
};

const EMPTY_FORM: InventoryFormValues = {
  productName: "",
  unitMeasurement: "",
  costPerUnit: "",
  accountNumber: "",
};

const toStr = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const toCurrency = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
};

export default function InventoryList() {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountsError, setAccountsError] = useState("");
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InventoryFormValues>({
    defaultValues: EMPTY_FORM,
  });

  const loadInventories = async () => {
    try {
      setIsLoading(true);
      setError("");

      const inventoriesRes = await fetch("http://localhost:8080/inventories", {
        method: "GET",
        credentials: "include",
      });

      if (!inventoriesRes.ok) {
        throw new Error("Failed to load inventories");
      }

      const inventoriesData = await inventoriesRes.json();

      const inventoryList = Array.isArray(inventoriesData)
        ? inventoriesData
        : inventoriesData?.data;

      setInventories(Array.isArray(inventoryList) ? inventoryList : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory list");
      setInventories([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventories();
  }, []);

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setAccountsError("");
        const res = await fetch("http://localhost:8080/chart-of-accounts/coa-items", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load COA accounts");
        }

        const data = await res.json();
        const accountList = Array.isArray(data) ? data : data?.data;
        setAccounts(Array.isArray(accountList) ? accountList : []);
      } catch (err) {
        setAccountsError(
          err instanceof Error ? err.message : "Failed to load COA accounts",
        );
      }
    };

    loadAccounts();
  }, []);

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

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const mapped = inventories.map((item) => {
      const accountNumber = toStr(item.account_number).trim();
      const coaDescription =
        toStr(item.coa?.AccountDescription ?? item.coa?.account_description).trim() ||
        "-";

      return {
        key:
          item.id ||
          item.ID ||
          item.product_code ||
          `${toStr(item.product_name)}-${accountNumber}-${toStr(item.cost_per_unit)}`,
        inventory: item,
        productName: toStr(item.product_name) || "-",
        unitMeasurement: toStr(item.unit_measurement) || "-",
        costPerUnit: toCurrency(item.cost_per_unit),
        accountNumber: accountNumber || "-",
        accountDescription: coaDescription,
      };
    });

    if (!keyword) return mapped;

    return mapped.filter((item) =>
      `${item.productName} ${item.unitMeasurement} ${item.accountNumber} ${item.accountDescription}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, inventories]);

  const getInventoryKey = (inventory: Inventory) =>
    inventory.id ?? inventory.ID ?? inventory.product_code;

  const openModifyModal = (inventory: Inventory) => {
    setSelectedInventory(inventory);
    setUpdateError("");
    reset({
      productName: toStr(inventory.product_name),
      unitMeasurement: toStr(inventory.unit_measurement),
      costPerUnit: toStr(inventory.cost_per_unit),
      accountNumber: toStr(inventory.account_number),
    });
    setIsModalOpen(true);
  };

  const closeModifyModal = () => {
    setIsModalOpen(false);
    setSelectedInventory(null);
    setUpdateError("");
    reset(EMPTY_FORM);
  };

  const handleUpdateInventory = async (values: InventoryFormValues) => {
    if (!selectedInventory) return;

    const inventoryKey = getInventoryKey(selectedInventory);
    if (inventoryKey === undefined || inventoryKey === null || inventoryKey === "") {
      setUpdateError("Missing inventory identifier.");
      return;
    }

    const payload = {
      product_name: values.productName.trim() || null,
      unit_measurement: values.unitMeasurement.trim() || null,
      cost_per_unit: Number(values.costPerUnit),
      account_number: values.accountNumber.trim() || null,
    };

    if (!Number.isFinite(payload.cost_per_unit)) {
      setUpdateError("Cost per unit must be a valid number.");
      return;
    }

    try {
      setUpdateError("");
      const res = await fetch(`http://localhost:8080/inventories/${inventoryKey}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update inventory");
      }

      alert("Inventory updated successfully.");
      closeModifyModal();
      await loadInventories();
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "Failed to update inventory",
      );
    }
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">View Inventory</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search and browse inventory records.
          </p>
        </div>

        <div className="px-6 py-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product, unit, account no, or account description..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="px-6 pb-6">
          {isLoading && (
            <p className="text-sm text-slate-600">Loading inventory...</p>
          )}

          {!isLoading && error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-3 py-2 font-medium">Product Name</th>
                    <th className="px-3 py-2 font-medium">Unit</th>
                    <th className="px-3 py-2 font-medium">Cost/Unit</th>
                    <th className="px-3 py-2 font-medium">Account Number</th>
                    <th className="px-3 py-2 font-medium">Account Description</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={6}>
                        No inventory found.
                      </td>
                    </tr>
                  )}

                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{row.productName}</td>
                      <td className="px-3 py-2 text-slate-700">{row.unitMeasurement}</td>
                      <td className="px-3 py-2 text-slate-700">{row.costPerUnit}</td>
                      <td className="px-3 py-2 text-slate-700">{row.accountNumber}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.accountDescription}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openModifyModal(row.inventory)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Modify
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && selectedInventory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Modify Inventory</h3>
            </div>

            <form onSubmit={handleSubmit(handleUpdateInventory)}>
              <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
                <OrdinaryInput
                  label="Product Name"
                  register={register("productName", {
                    required: "Product name is required",
                    validate: (v) =>
                      v.trim().length > 0 || "Product name is required",
                    maxLength: { value: 200, message: "Max 200 characters" },
                  })}
                  error={errors.productName}
                />

                <OrdinaryInput
                  label="Unit Measurement"
                  register={register("unitMeasurement", {
                    required: "Unit measurement is required",
                    validate: (v) =>
                      v.trim().length > 0 || "Unit measurement is required",
                    maxLength: { value: 100, message: "Max 100 characters" },
                  })}
                  error={errors.unitMeasurement}
                />

                <OrdinaryInput
                  label="Cost Per Unit"
                  type="number"
                  register={register("costPerUnit", {
                    required: "Cost per unit is required",
                    validate: (v) => {
                      const n = Number(v);
                      if (!Number.isFinite(n)) return "Cost per unit must be a valid number";
                      if (n < 0) return "Cost per unit must be zero or greater";
                      return true;
                    },
                  })}
                  error={errors.costPerUnit}
                />

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
                    Account Number
                  </label>
                  <Controller
                    control={control}
                    name="accountNumber"
                    rules={{ required: "Account number is required" }}
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
                  {errors.accountNumber && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.accountNumber.message}
                    </p>
                  )}
                </div>

                {accountsError && (
                  <p className="md:col-span-2 text-sm text-rose-600">{accountsError}</p>
                )}

                {updateError && (
                  <p className="md:col-span-2 text-sm text-rose-600">{updateError}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={closeModifyModal}
                  disabled={isSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSubmitting ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
