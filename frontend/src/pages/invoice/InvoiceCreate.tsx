import { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Combobox } from "../../components/ui/combobox";

type LookupOption = {
  value: string;
  label: string;
  search_text: string;
};

type ProductLookupOption = LookupOption & {
  unit_measurement: string;
  unit_price: number;
};

type InvoiceLookupsResponse = {
  customers?: LookupOption[];
  products?: ProductLookupOption[];
};

type InvoiceItemForm = {
  productId: string;
  quantity: string;
  unitPrice: string;
  vatable: boolean;
};

type InvoiceFormValues = {
  customerId: string;
  customer: string;
  items: InvoiceItemForm[];
};

const emptyItem = (): InvoiceItemForm => ({
  productId: "",
  quantity: "1",
  unitPrice: "",
  vatable: true,
});

const toAmount = (quantity: string, unitPrice: string): number => {
  const parsedQuantity = Number(quantity);
  const parsedUnitPrice = Number(unitPrice);
  if (!Number.isFinite(parsedQuantity) || !Number.isFinite(parsedUnitPrice)) {
    return 0;
  }
  return parsedQuantity * parsedUnitPrice;
};

export default function InvoiceCreate() {
  const [customerOptions, setCustomerOptions] = useState<LookupOption[]>([]);
  const [productOptions, setProductOptions] = useState<ProductLookupOption[]>([]);
  const [loadError, setLoadError] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<InvoiceFormValues>({
    defaultValues: {
      customerId: "",
      customer: "",
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
        const res = await fetch("http://localhost:8080/invoices/lookups", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load invoice lookups");
        }

        const data = (await res.json()) as InvoiceLookupsResponse;
        setCustomerOptions(Array.isArray(data.customers) ? data.customers : []);
        setProductOptions(Array.isArray(data.products) ? data.products : []);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load invoice lookups",
        );
      }
    };

    void loadLookups();
  }, []);

  const selectedCustomerId = watch("customerId");
  const watchedItems = watch("items");

  const customerById = useMemo(
    () => new Map(customerOptions.map((option) => [option.value, option])),
    [customerOptions],
  );

  const productById = useMemo(
    () => new Map(productOptions.map((option) => [option.value, option])),
    [productOptions],
  );

  useEffect(() => {
    const selectedCustomer = customerById.get(selectedCustomerId);
    setValue("customer", selectedCustomer?.label || "", { shouldDirty: true });
  }, [customerById, selectedCustomerId, setValue]);

  const invoiceTotal = useMemo(
    () =>
      watchedItems.reduce(
        (sum, item) => sum + toAmount(item.quantity, item.unitPrice),
        0,
      ),
    [watchedItems],
  );

  const onSubmit = async (values: InvoiceFormValues) => {
    const customer = values.customer.trim();
    if (!customer) {
      alert("Please select a valid customer from the list.");
      return;
    }

    const payload = {
      customer,
      items: values.items.map((item, index) => ({
        product_id: item.productId,
        line_no: index + 1,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice),
        vatable: Boolean(item.vatable),
      })),
    };

    const res = await fetch("http://localhost:8080/invoices", {
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
      customerId: "",
      customer: "",
      items: [emptyItem()],
    });
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Create Invoice
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Select customer and add invoice product lines.
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
                  Customer
                </h3>
                <p className="text-xs text-slate-500">
                  Search and select customer from the master list.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
                    Customer
                  </label>
                  <Controller
                    control={control}
                    name="customerId"
                    rules={{ required: "Customer is required" }}
                    render={({ field }) => (
                      <Combobox
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        items={customerOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                          searchText: option.search_text,
                        }))}
                        placeholder="Select customer..."
                        searchPlaceholder="Search customer..."
                        emptyText="No customer found"
                      />
                    )}
                  />
                  {errors.customerId && (
                    <p className="mt-1 text-xs text-rose-600">
                      {errors.customerId.message}
                    </p>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    readOnly
                    className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    {...register("customer")}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Items</h3>
                  <p className="text-xs text-slate-500">
                    Add products, quantities, and VAT flags for this invoice.
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  Total: {invoiceTotal.toFixed(2)}
                </p>
              </div>

              <div className="space-y-4">
                {fields.map((field, index) => {
                  const selectedProduct = productById.get(
                    watchedItems[index]?.productId || "",
                  );
                  const lineAmount = toAmount(
                    watchedItems[index]?.quantity || "",
                    watchedItems[index]?.unitPrice || "",
                  );

                  return (
                    <div
                      key={field.id}
                      className="rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-slate-700">
                            Product
                          </label>
                          <Controller
                            control={control}
                            name={`items.${index}.productId` as const}
                            rules={{ required: "Product is required" }}
                            render={({ field: productField }) => (
                              <Combobox
                                value={productField.value || ""}
                                onValueChange={(value) => {
                                  productField.onChange(value);
                                  const product = productById.get(value);
                                  setValue(
                                    `items.${index}.unitPrice`,
                                    product ? String(product.unit_price) : "",
                                    { shouldDirty: true },
                                  );
                                }}
                                items={productOptions.map((option) => ({
                                  value: option.value,
                                  label: option.label,
                                  searchText: option.search_text,
                                }))}
                                placeholder="Select product..."
                                searchPlaceholder="Search product..."
                                emptyText="No product found"
                              />
                            )}
                          />
                          {errors.items?.[index]?.productId && (
                            <p className="mt-1 text-xs text-rose-600">
                              {errors.items[index]?.productId?.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            {...register(`items.${index}.quantity` as const, {
                              required: "Quantity is required",
                              validate: (value) =>
                                Number(value) > 0 ||
                                "Quantity must be greater than zero",
                            })}
                          />
                          {errors.items?.[index]?.quantity && (
                            <p className="mt-1 text-xs text-rose-600">
                              {errors.items[index]?.quantity?.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">
                            Unit Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                            {...register(`items.${index}.unitPrice` as const, {
                              required: "Unit price is required",
                              validate: (value) =>
                                Number(value) >= 0 ||
                                "Unit price must be zero or greater",
                            })}
                          />
                          {errors.items?.[index]?.unitPrice && (
                            <p className="mt-1 text-xs text-rose-600">
                              {errors.items[index]?.unitPrice?.message}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">
                            Unit
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={selectedProduct?.unit_measurement || "-"}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700">
                            Amount
                          </label>
                          <input
                            type="text"
                            readOnly
                            value={lineAmount.toFixed(2)}
                            className="mt-1 w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            {...register(`items.${index}.vatable` as const)}
                          />
                          Vatable
                        </label>

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
                  );
                })}
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
                onClick={() =>
                  reset({
                    customerId: "",
                    customer: "",
                    items: [emptyItem()],
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
                {isSubmitting ? "Saving..." : "Create Invoice"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
