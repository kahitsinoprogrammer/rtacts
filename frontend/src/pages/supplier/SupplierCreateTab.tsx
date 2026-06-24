//import React from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
type FormValues = {
  supplierCode: string;
  supplierName: string;

  contactPerson: string;
  phone: string;
  email: string;

  address: string; // ✅ single line
  taxId: string;
  paymentTerms: string;
  notes: string;

  isActive: string; // "true" | "false"
};

export default function SupplierCreateTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      supplierCode: "",
      supplierName: "",
      contactPerson: "",
      phone: "",
      email: "",
      address: "",
      taxId: "",
      paymentTerms: "",
      notes: "",
      isActive: "true",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      supplier_code: values.supplierCode.trim(),
      supplier_name: values.supplierName.trim(),

      contact_person: values.contactPerson.trim() || null,
      contact_no: values.phone.trim() || null,
      email: values.email.trim() || null,

      address: values.address.trim() || null, // ✅ single line address

      tax_id: values.taxId.trim() || null,
      payment_terms: values.paymentTerms.trim() || null,
      notes: values.notes.trim() || null,

      is_active: values.isActive === "true",
    };

    const res = await fetch("http://localhost:8080/suppliers", {
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
    reset();
  };

  return (
    <div className="w-full overflow-x-hidden">
      <div className="w-full max-w-6xl overflow-hidden">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="truncate text-lg font-semibold text-slate-900">
              Create Supplier
            </h2>
            <p className="mt-1 truncate text-sm text-slate-600">
              Fill in the supplier details below.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-6 px-6 py-6"
          >
            {/* Main info */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        

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

            {/* Contact + Accounting */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Contact */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    Contact
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    How you reach this supplier.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <OrdinaryInput
                    label="Contact Person"
                    register={register("contactPerson", {
                      maxLength: { value: 150, message: "Max 150 characters" },
                    })}
                    error={errors.contactPerson}
                  />

                  <OrdinaryInput
                    label="Phone"
                    register={register("phone", {
                      maxLength: { value: 50, message: "Max 50 characters" },
                    })}
                    error={errors.phone}
                  />

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
              </div>

              {/* Accounting */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    Accounting
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Optional billing details.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <OrdinaryInput
                    label="Tax ID"
                    register={register("taxId", {
                      maxLength: { value: 50, message: "Max 50 characters" },
                    })}
                    error={errors.taxId}
                  />


                  {/* Spacer to keep the grid balanced on md */}
                  <div className="hidden md:block" />
                </div>
              </div>
            </div>

            {/* Address + Notes */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    Address
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Single-line supplier address.
                  </p>
                </div>

                <OrdinaryInput
                  label="Address"
                  register={register("address", {
                    maxLength: { value: 300, message: "Max 300 characters" },
                  })}
                  error={errors.address}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="truncate text-sm font-semibold text-slate-900">
                    Notes
                  </h3>
                  <p className="truncate text-xs text-slate-500">
                    Optional extra details.
                  </p>
                </div>

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
                    Notes
                  </label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    {...register("notes", {
                      maxLength: {
                        value: 1000,
                        message: "Max 1000 characters",
                      },
                    })}
                    placeholder="Any extra details about this supplier..."
                  />
                  <div className="mt-1">
                    {errors.notes?.message && (
                      <p className="text-xs text-rose-600">
                        {errors.notes.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={() => reset()}
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
                {isSubmitting ? "Saving..." : "Create Supplier"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
