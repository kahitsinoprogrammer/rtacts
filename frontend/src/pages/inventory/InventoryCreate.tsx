import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
import { Combobox } from "../../components/ui/combobox";

type LookupOption = {
  value: string;
  label: string;
  search_text: string;
};

type InventoryLookupsResponse = {
  account_options?: LookupOption[];
};

type FormValues = {
  productName: string;
  unitMeasurement: string;
  costPerUnit: string;
  coaId: string;
};

export default function InventoryCreate() {
  const [accountOptions, setAccountOptions] = useState<LookupOption[]>([]);
  const [loadError, setLoadError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      productName: "",
      unitMeasurement: "",
      costPerUnit: "",
      coaId: "",
    },
  });

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadError("");
        const res = await fetch("http://localhost:8080/inventories/lookups", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load inventory lookups");
        }

        const data = (await res.json()) as InventoryLookupsResponse;
        setAccountOptions(
          Array.isArray(data.account_options) ? data.account_options : [],
        );
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load inventory lookups",
        );
      }
    };

    loadAccounts();
  }, []);

  const onSubmit = async (values: FormValues) => {
    const payload = {
      product_name: values.productName.trim(),
      unit_measurement: values.unitMeasurement.trim(),
      cost_per_unit: Number(values.costPerUnit),
      account_number: values.coaId.trim(),
    };

    const res = await fetch("http://localhost:8080/inventories", {
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
      productName: "",
      unitMeasurement: "",
      costPerUnit: "",
      coaId: "",
    });
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="truncate text-lg font-semibold text-slate-900">
              Create Inventory
            </h2>
            <p className="mt-1 truncate text-sm text-slate-600">
              Fill in the inventory details below.
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
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  Inventory Details
                </h3>
                <p className="truncate text-xs text-slate-500">
                  Basic product and costing information.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                    COA Account
                  </label>
                  <Controller
                    control={control}
                    name="coaId"
                    rules={{ required: "COA account is required" }}
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
                  {errors.coaId && (
                    <p className="mt-1 text-xs text-rose-600">{errors.coaId.message}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  reset({
                    productName: "",
                    unitMeasurement: "",
                    costPerUnit: "",
                    coaId: "",
                  })
                }
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
                {isSubmitting ? "Saving..." : "Create Inventory"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
