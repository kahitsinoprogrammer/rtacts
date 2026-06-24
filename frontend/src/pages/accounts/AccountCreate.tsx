import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
import PasswordInput from "../../components/PasswordInput";
type FormValues = {
  username: string;
  password: string;
  confirmPassword: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  contactNo: string;
};

export default function AccountCreate() {
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      firstName: "",
      lastName: "",
      middleName: "",
      dateOfBirth: "",
      contactNo: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      username: values.username.trim(),
      password: values.password,
      email: values.email.trim(),
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      middle_name: values.middleName.trim() || "",
      date_of_birth: values.dateOfBirth || "",
      contact_no: values.contactNo.trim() || "",
      user_type: "admin",
    };

    const res = await fetch("http://localhost:8080/accounts", {
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
            <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
            <p className="mt-1 text-sm text-slate-600">Fill in the account details below.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <OrdinaryInput
                label="Username"
                register={register("username", {
                  required: "Username is required",
                  validate: (v) => v.trim().length > 0 || "Username is required",
                  maxLength: { value: 100, message: "Max 100 characters" },
                })}
                error={errors.username}
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
                  <h3 className="text-sm font-semibold text-slate-900">Security</h3>
                  <p className="text-xs text-slate-500">Login credentials for the new user.</p>
                </div>

                <PasswordInput
                  label="Password"
                  register={register("password", {
                    required: "Password is required",
                    minLength: { value: 6, message: "Minimum 6 characters" },
                    maxLength: { value: 255, message: "Max 255 characters" },
                  })}
                  error={errors.password}
                />

                <div className="mt-4">
                  <PasswordInput
                    label="Confirm Password"
                    register={register("confirmPassword", {
                      required: "Confirm password is required",
                      validate: (v) => v === getValues("password") || "Passwords do not match",
                    })}
                    error={errors.confirmPassword}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Contact</h3>
                  <p className="text-xs text-slate-500">Basic contact details.</p>
                </div>

                <OrdinaryInput
                  label="Contact No"
                  register={register("contactNo", {
                    maxLength: { value: 50, message: "Max 50 characters" },
                  })}
                  error={errors.contactNo}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Name</h3>
                  <p className="text-xs text-slate-500">User profile details.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <OrdinaryInput
                    label="First Name"
                    register={register("firstName", {
                      required: "First name is required",
                      maxLength: { value: 255, message: "Max 255 characters" },
                    })}
                    error={errors.firstName}
                  />

                  <OrdinaryInput
                    label="Last Name"
                    register={register("lastName", {
                      required: "Last name is required",
                      maxLength: { value: 255, message: "Max 255 characters" },
                    })}
                    error={errors.lastName}
                  />

                  <OrdinaryInput
                    label="Middle Name"
                    register={register("middleName", {
                      maxLength: { value: 255, message: "Max 255 characters" },
                    })}
                    error={errors.middleName}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Birth Date</h3>
                  <p className="text-xs text-slate-500">Optional date of birth.</p>
                </div>

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">Date of Birth</label>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    {...register("dateOfBirth")}
                  />
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
                {isSubmitting ? "Saving..." : "Create User"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
