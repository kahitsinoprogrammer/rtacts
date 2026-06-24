import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";

type Supplier = {
  id?: number | string;
  supplier_id?: number | string;
  supplier_code?: string | null;
  supplier_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  contact_no?: string | null;
  email?: string | null;
  address?: string | null;
  tax_id?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  is_active?: boolean | null;
};

type SupplierFormValues = {
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  paymentTerms: string;
  notes: string;
  isActive: string;
};

const EMPTY_FORM: SupplierFormValues = {
  supplierName: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  taxId: "",
  paymentTerms: "",
  notes: "",
  isActive: "true",
};

export default function SupplierViewTab() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormValues>({
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setIsLoading(true);
        setError("");

        const res = await fetch("http://localhost:8080/suppliers", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load suppliers");
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data;
        setSuppliers(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load suppliers");
        setSuppliers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return suppliers;
    return suppliers.filter((supplier) =>
      (supplier.supplier_name || "").toLowerCase().includes(keyword),
    );
  }, [search, suppliers]);

  const getSupplierKey = (supplier: Supplier) => supplier.id ?? supplier.supplier_id;

  const openModifyModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setUpdateError("");
    reset({
      supplierName: supplier.supplier_name || "",
      contactPerson: supplier.contact_person || "",
      phone: supplier.phone || supplier.contact_no || "",
      email: supplier.email || "",
      address: supplier.address || "",
      taxId: supplier.tax_id || "",
      paymentTerms: supplier.payment_terms || "",
      notes: supplier.notes || "",
      isActive: supplier.is_active === false ? "false" : "true",
    });
    setIsModalOpen(true);
  };

  const closeModifyModal = () => {
    setIsModalOpen(false);
    setSelectedSupplier(null);
    setUpdateError("");
    reset(EMPTY_FORM);
  };

  const handleUpdateSupplier = async (values: SupplierFormValues) => {
    if (!selectedSupplier) return;

    const supplierKey = getSupplierKey(selectedSupplier);
    if (supplierKey === undefined || supplierKey === null) {
      setUpdateError("Missing supplier identifier.");
      return;
    }

    const payload = {
      supplier_name: values.supplierName.trim() || null,
      contact_person: values.contactPerson.trim() || null,
      phone: values.phone.trim() || null,
      email: values.email.trim() || null,
      address: values.address.trim() || null,
      tax_id: values.taxId.trim() || null,
      notes: values.notes.trim() || null,
      is_active: values.isActive === "true",
    };

    try {
      setUpdateError("");

      const res = await fetch(`http://localhost:8080/suppliers/${supplierKey}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update supplier");
      }

      setSuppliers((prev) =>
        prev.map((supplier) =>
          getSupplierKey(supplier) === supplierKey ? { ...supplier, ...payload } : supplier,
        ),
      );

      alert("Supplier updated successfully.");
      closeModifyModal();
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "Failed to update supplier",
      );
    }
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">
            View Suppliers
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Search and browse supplier records.
          </p>
        </div>

        <div className="px-6 py-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier name..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="px-6 pb-6">
          {isLoading && (
            <p className="text-sm text-slate-600">Loading suppliers...</p>
          )}

          {!isLoading && error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-3 py-2 font-medium">Supplier Name</th>
                    <th className="px-3 py-2 font-medium">Contact Person</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={6}>
                        No suppliers found.
                      </td>
                    </tr>
                  )}

                  {filteredSuppliers.map((supplier, index) => (
                    <tr
                      key={
                        supplier.id ??
                        supplier.supplier_id ??
                        `${supplier.supplier_name}-${index}`
                      }
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2 text-slate-900">
                        {supplier.supplier_name || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {supplier.contact_person || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {supplier.phone || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {supplier.email || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {supplier.is_active === false ? "Inactive" : "Active"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openModifyModal(supplier)}
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

      {isModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Modify Supplier</h3>
            </div>

            <form onSubmit={handleSubmit(handleUpdateSupplier)}>
              <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
           

                <div>
                  <OrdinaryInput
                    label="Supplier Name"
                    register={register("supplierName", {
                      required: "Supplier name is required",
                      validate: (v) =>
                        v.trim().length > 0 || "Supplier name is required",
                      maxLength: { value: 200, message: "Max 200 characters" },
                    })}
                    error={errors.supplierName}
                  />
                </div>

                <div>
                  <OrdinaryInput
                    label="Contact Person"
                    register={register("contactPerson", {
                      maxLength: { value: 150, message: "Max 150 characters" },
                    })}
                    error={errors.contactPerson}
                  />
                </div>

                <div>
                  <OrdinaryInput
                    label="Phone"
                    register={register("phone", {
                      maxLength: { value: 50, message: "Max 50 characters" },
                    })}
                    error={errors.phone}
                  />
                </div>

                <div>
                  <OrdinaryInput
                    label="Email"
                    register={register("email", {
                      maxLength: { value: 150, message: "Max 150 characters" },
                      validate: (v) => {
                        if (!v?.trim()) return true;
                        return (
                          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ||
                          "Invalid email"
                        );
                      },
                    })}
                    error={errors.email}
                  />
                </div>

                <div>
                  <OrdinaryInput
                    label="Tax ID"
                    register={register("taxId", {
                      maxLength: { value: 50, message: "Max 50 characters" },
                    })}
                    error={errors.taxId}
                  />
                </div>

       

                <div>
                  <OrdinaryInput
                    label="Address"
                    register={register("address", {
                      maxLength: { value: 300, message: "Max 300 characters" },
                    })}
                    error={errors.address}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    rows={3}
                    {...register("notes", {
                      maxLength: {
                        value: 1000,
                        message: "Max 1000 characters",
                      },
                    })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="mt-1">
                    {errors.notes?.message && (
                      <p className="text-xs text-rose-600">
                        {errors.notes.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    {...register("isActive")}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>

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
