import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";

type FormValues = {
  customerName: string;
  email: string;
  contactPerson: string;
  phone: string;
  address: string;
  taxId: string;
  notes: string;
};

export default function CustomerCreateTab() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      customerName: "",
      email: "",
      contactPerson: "",
      phone: "",
      address: "",
      taxId: "",
      notes: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      customer_name: values.customerName.trim(),
      email: values.email.trim(),
      contact_person: values.contactPerson.trim() || null,
      phone: values.phone.trim() || null,
      address: values.address.trim() || null,
      tax_id: values.taxId.trim() || null,
      notes: values.notes.trim() || null,
    };

    const res = await fetch("http://localhost:8080/customers", {
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
    <div className="w-full">
      <div className="w-full max-w-6xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Create Customer</h2>
            <p className="mt-1 text-sm text-slate-600">Fill in the customer details below.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <OrdinaryInput
                label="Customer Name"
                register={register("customerName", {
                  required: "Customer name is required",
                  validate: (v) => v.trim().length > 0 || "Customer name is required",
                  maxLength: { value: 100, message: "Max 100 characters" },
                })}
                error={errors.customerName}
              />

              <OrdinaryInput
                label="Email"
                register={register("email", {
                  required: "Email is required",
                  validate: (v) => {
                    if (!v?.trim()) return "Email is required";
                    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || "Invalid email";
                  },
                  maxLength: { value: 255, message: "Max 255 characters" },
                })}
                error={errors.email}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Contact</h3>
                  <p className="text-xs text-slate-500">How you reach this customer.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <OrdinaryInput
                    label="Contact Person"
                    register={register("contactPerson", {
                      maxLength: { value: 255, message: "Max 255 characters" },
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
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Billing</h3>
                  <p className="text-xs text-slate-500">Optional billing details.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <OrdinaryInput
                    label="Tax ID"
                    register={register("taxId", {
                      maxLength: { value: 50, message: "Max 50 characters" },
                    })}
                    error={errors.taxId}
                  />

        
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Address</h3>
                  <p className="text-xs text-slate-500">Customer address details.</p>
                </div>

                <OrdinaryInput
                  label="Address"
                  register={register("address", {
                    maxLength: { value: 1000, message: "Max 1000 characters" },
                  })}
                  error={errors.address}
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
                  <p className="text-xs text-slate-500">Optional extra details.</p>
                </div>

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    rows={4}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    {...register("notes", {
                      maxLength: {
                        value: 2000,
                        message: "Max 2000 characters",
                      },
                    })}
                    placeholder="Any extra details about this customer..."
                  />
                  <div className="mt-1">
                    {errors.notes?.message && <p className="text-xs text-rose-600">{errors.notes.message}</p>}
                  </div>
                </div>
              </div>
            </div>

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
                {isSubmitting ? "Saving..." : "Create Customer"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
