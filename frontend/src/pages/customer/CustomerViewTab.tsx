import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";

type Customer = {
  customer_id?: string;
  customer_name?: string | null;
  email?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  status?: string | null;
  notes?: string | null;
};

type CustomerFormValues = {
  customerName: string;
  email: string;
  contactPerson: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
  isActive: string;
};

const EMPTY_FORM: CustomerFormValues = {
  customerName: "",
  email: "",
  contactPerson: "",
  phone: "",
  address: "",
  taxId: "",
  notes: "",
  isActive: "true",
};

export default function CustomerViewTab() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        setError("");

        const res = await fetch("http://localhost:8080/customers", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load customers");
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data;
        setCustomers(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load customers");
        setCustomers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((customer) =>
      `${customer.customer_name || ""} ${customer.email || ""}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, customers]);

  const openModifyModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setUpdateError("");
    reset({
      customerName: customer.customer_name || "",
      email: customer.email || "",
      contactPerson: customer.contact_person || "",
      phone: customer.phone || "",
      address: customer.address || "",
      taxId: customer.tax_id || "",
      notes: customer.notes || "",
      isActive:
        (customer.status || "").toLowerCase() === "inactive" ? "false" : "true",
    });
    setIsModalOpen(true);
  };

  const closeModifyModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
    setUpdateError("");
    reset(EMPTY_FORM);
  };

  const handleUpdateCustomer = async (values: CustomerFormValues) => {
    if (!selectedCustomer?.customer_id) {
      setUpdateError("Missing customer identifier.");
      return;
    }

    const payload = {
      customer_name: values.customerName.trim(),
      email: values.email.trim(),
      contact_person: values.contactPerson.trim() || null,
      phone: values.phone.trim() || null,
      address: values.address.trim() || null,
      tax_id: values.taxId.trim() || null,
      notes: values.notes.trim() || null,
      is_active: values.isActive === "true",
    };

    try {
      setUpdateError("");

      const res = await fetch(
        `http://localhost:8080/customers/${selectedCustomer.customer_id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to update customer");
      }

      setCustomers((prev) =>
        prev.map((customer) =>
          customer.customer_id === selectedCustomer.customer_id
            ? {
                ...customer,
                ...payload,
                status: payload.is_active ? "active" : "inactive",
              }
            : customer,
        ),
      );

      alert("Customer updated successfully.");
      closeModifyModal();
    } catch (err) {
      setUpdateError(
        err instanceof Error ? err.message : "Failed to update customer",
      );
    }
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">View Customers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search and browse customer records.
          </p>
        </div>

        <div className="px-6 py-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name or email..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="px-6 pb-6">
          {isLoading && (
            <p className="text-sm text-slate-600">Loading customers...</p>
          )}

          {!isLoading && error && <p className="text-sm text-rose-600">{error}</p>}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-3 py-2 font-medium">Customer Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Contact Person</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={6}>
                        No customers found.
                      </td>
                    </tr>
                  )}

                  {filteredCustomers.map((customer, index) => (
                    <tr
                      key={customer.customer_id ?? `${customer.customer_name}-${index}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2 text-slate-900">
                        {customer.customer_name || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {customer.email || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {customer.contact_person || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {customer.phone || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {(customer.status || "").toLowerCase() === "inactive"
                          ? "Inactive"
                          : "Active"}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openModifyModal(customer)}
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

      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Modify Customer
              </h3>
            </div>

            <form onSubmit={handleSubmit(handleUpdateCustomer)}>
              <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
                <div>
                  <OrdinaryInput
                    label="Customer Name"
                    register={register("customerName", {
                      required: "Customer name is required",
                      validate: (v) =>
                        v.trim().length > 0 || "Customer name is required",
                      maxLength: { value: 100, message: "Max 100 characters" },
                    })}
                    error={errors.customerName}
                  />
                </div>

                <div>
                  <OrdinaryInput
                    label="Email"
                    register={register("email", {
                      required: "Email is required",
                      validate: (v) => {
                        if (!v?.trim()) return "Email is required";
                        return (
                          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ||
                          "Invalid email"
                        );
                      },
                      maxLength: { value: 255, message: "Max 255 characters" },
                    })}
                    error={errors.email}
                  />
                </div>

                <div>
                  <OrdinaryInput
                    label="Contact Person"
                    register={register("contactPerson", {
                      maxLength: { value: 255, message: "Max 255 characters" },
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
                      maxLength: { value: 1000, message: "Max 1000 characters" },
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
                        value: 2000,
                        message: "Max 2000 characters",
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
