import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
import { UserContext } from "../../context/UserContext";

type CompanySettingsFormValues = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
};

type CompanySettingsResponse = {
  company_id?: string | null;
  company_name?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_address?: string | null;
};

const EMPTY_FORM: CompanySettingsFormValues = {
  companyName: "",
  companyEmail: "",
  companyPhone: "",
  companyAddress: "",
};

const toStr = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const getErrorMessage = async (res: Response, fallback: string) => {
  const raw = await res.text();
  const trimmed = raw.trim();

  if (!trimmed) {
    return `${fallback} (${res.status})`;
  }

  try {
    const data = JSON.parse(trimmed);
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
  } catch {
    return `${fallback} (${res.status}: ${trimmed})`;
  }

  return `${fallback} (${res.status})`;
};

export default function CompanySettings() {
  const user = useContext(UserContext);
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [initialValues, setInitialValues] =
    useState<CompanySettingsFormValues>(EMPTY_FORM);
  const userType = (user?.UserType ?? user?.user_type ?? "").trim().toLowerCase();
  const canManageCompanySettings = userType === "genesis_admin";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CompanySettingsFormValues>({
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    if (!canManageCompanySettings) {
      setIsLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        setIsLoading(true);
        setLoadError("");

        const res = await fetch("http://localhost:8080/settings/company", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(await getErrorMessage(res, "Failed to load company settings"));
        }

        const data: CompanySettingsResponse = await res.json();
        const nextValues = {
          companyName: toStr(data.company_name),
          companyEmail: toStr(data.company_email),
          companyPhone: toStr(data.company_phone),
          companyAddress: toStr(data.company_address),
        };

        setCompanyId(toStr(data.company_id));
        setInitialValues(nextValues);
        reset(nextValues);
      } catch (err) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load company settings",
        );
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, [canManageCompanySettings, reset]);

  const onSubmit = async (values: CompanySettingsFormValues) => {
    const payload = {
      company_name: values.companyName.trim(),
      company_email: values.companyEmail.trim(),
      company_phone: values.companyPhone.trim(),
      company_address: values.companyAddress.trim(),
    };

    try {
      setSaveError("");
      setSaveSuccess("");

      const res = await fetch("http://localhost:8080/settings/company", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to update company settings"));
      }

      const data = await res.json();
      const settings: CompanySettingsResponse | undefined = data?.data;

      if (settings) {
        const nextValues = {
          companyName: toStr(settings.company_name),
          companyEmail: toStr(settings.company_email),
          companyPhone: toStr(settings.company_phone),
          companyAddress: toStr(settings.company_address),
        };

        setCompanyId(toStr(settings.company_id));
        setInitialValues(nextValues);
        reset(nextValues);
      }

      setSaveSuccess("Company settings updated successfully.");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to update company settings",
      );
    }
  };

  if (!canManageCompanySettings) {
    return (
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Company Settings</h2>
        <p className="mt-2 text-sm text-slate-600">
          Only the company&apos;s registered <code>genesis_admin</code> can manage
          these settings.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Company Settings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Update the details for the company linked to your account. These
            changes only apply within your own company workspace.
          </p>
          {companyId && (
            <p className="mt-2 text-xs text-slate-500">Company ID: {companyId}</p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          {isLoading && <p className="text-sm text-slate-600">Loading company settings...</p>}

          {!isLoading && loadError && (
            <p className="text-sm text-rose-600">{loadError}</p>
          )}

          {!isLoading && !loadError && (
            <>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Company Profile
                    </h3>
                    <p className="text-xs text-slate-500">
                      Core information used for your company setup.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <OrdinaryInput
                      label="Company Name"
                      register={register("companyName", {
                        required: "Company name is required",
                        validate: (value) =>
                          value.trim().length > 0 || "Company name is required",
                        maxLength: { value: 255, message: "Max 255 characters" },
                      })}
                      error={errors.companyName}
                    />

                    <OrdinaryInput
                      label="Company Email"
                      register={register("companyEmail", {
                        validate: (value) => {
                          if (!value.trim()) return true;
                          return (
                            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
                            "Invalid email"
                          );
                        },
                        maxLength: { value: 255, message: "Max 255 characters" },
                      })}
                      error={errors.companyEmail}
                    />

                    <OrdinaryInput
                      label="Company Phone"
                      register={register("companyPhone", {
                        maxLength: { value: 50, message: "Max 50 characters" },
                      })}
                      error={errors.companyPhone}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Company Address
                    </h3>
                    <p className="text-xs text-slate-500">
                      Maintain the mailing or office address for this company.
                    </p>
                  </div>

                  <div className="flex flex-col">
                    <label className="block text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <textarea
                      rows={8}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                      {...register("companyAddress", {
                        maxLength: { value: 2000, message: "Max 2000 characters" },
                      })}
                    />
                    {errors.companyAddress && (
                      <p className="mt-1 text-sm text-rose-600">
                        {errors.companyAddress.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {saveError && <p className="text-sm text-rose-600">{saveError}</p>}
              {saveSuccess && <p className="text-sm text-emerald-600">{saveSuccess}</p>}

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSaveError("");
                    setSaveSuccess("");
                    reset(initialValues);
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Save Company Settings"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
