import { useContext, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";
import { UserContext } from "../../context/UserContext";

type CompanySettingsFormValues = {
  companyName: string;
  tin: string;
  companyEmail: string;
  companyPhone: string;
  companyPic: string;
  blockNo: string;
  city: string;
  province: string;
  country: string;
  zip: string;
};

type CompanySettingsResponse = {
  company_id?: string | null;
  company_name?: string | null;
  tin?: string | null;
  company_email?: string | null;
  company_phone?: string | null;
  company_address?: string | null;
  company_pic?: string | null;
  block_no?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  zip?: string | null;
};

const EMPTY_FORM: CompanySettingsFormValues = {
  companyName: "",
  tin: "",
  companyEmail: "",
  companyPhone: "",
  companyPic: "",
  blockNo: "",
  city: "",
  province: "",
  country: "",
  zip: "",
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

const isValidHttpUrl = (value: string) => {
  if (!value.trim()) return false;

  try {
    const parsedUrl = new URL(value.trim());
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

const buildCompanyAddress = (values: Pick<CompanySettingsFormValues, "blockNo" | "city" | "province" | "country" | "zip">) =>
  [values.blockNo, values.city, values.province, values.country, values.zip]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(", ");

export default function CompanySettings() {
  const user = useContext(UserContext);
  const [companyId, setCompanyId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isPreviewBroken, setIsPreviewBroken] = useState(false);
  const [initialValues, setInitialValues] =
    useState<CompanySettingsFormValues>(EMPTY_FORM);
  const userType = (user?.UserType ?? user?.user_type ?? "").trim().toLowerCase();
  const canManageCompanySettings = userType === "genesis_admin";

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CompanySettingsFormValues>({
    defaultValues: EMPTY_FORM,
  });
  const companyPicPreview = watch("companyPic", "").trim();
  const hasValidCompanyPicPreview = isValidHttpUrl(companyPicPreview);

  useEffect(() => {
    setIsPreviewBroken(false);
  }, [companyPicPreview]);

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
          tin: toStr(data.tin),
          companyEmail: toStr(data.company_email),
          companyPhone: toStr(data.company_phone),
          companyPic: toStr(data.company_pic),
          blockNo: toStr(data.block_no),
          city: toStr(data.city),
          province: toStr(data.province),
          country: toStr(data.country),
          zip: toStr(data.zip),
        };

        setCompanyId(toStr(data.company_id));
        setInitialValues(nextValues);
        setIsPreviewBroken(false);
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
      tin: values.tin.trim(),
      company_email: values.companyEmail.trim(),
      company_phone: values.companyPhone.trim(),
      company_pic: values.companyPic.trim(),
      company_address: buildCompanyAddress(values),
      block_no: values.blockNo.trim(),
      city: values.city.trim(),
      province: values.province.trim(),
      country: values.country.trim(),
      zip: values.zip.trim(),
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
          tin: toStr(settings.tin),
          companyEmail: toStr(settings.company_email),
          companyPhone: toStr(settings.company_phone),
          companyPic: toStr(settings.company_pic),
          blockNo: toStr(settings.block_no),
          city: toStr(settings.city),
          province: toStr(settings.province),
          country: toStr(settings.country),
          zip: toStr(settings.zip),
        };

        setCompanyId(toStr(settings.company_id));
        setInitialValues(nextValues);
        setIsPreviewBroken(false);
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
                      label="TIN"
                      register={register("tin", {
                        maxLength: { value: 100, message: "Max 100 characters" },
                      })}
                      error={errors.tin}
                    />

                    <OrdinaryInput
                      label="Company Phone"
                      register={register("companyPhone", {
                        maxLength: { value: 50, message: "Max 50 characters" },
                      })}
                      error={errors.companyPhone}
                    />

                    <OrdinaryInput
                      label="Company Image URL"
                      type="url"
                      placeholder="https://example.com/logo.png"
                      register={register("companyPic", {
                        maxLength: { value: 2000, message: "Max 2000 characters" },
                        validate: (value) => {
                          if (!value.trim()) return true;
                          return (
                            isValidHttpUrl(value) ||
                            "Enter a valid http:// or https:// image URL"
                          );
                        },
                      })}
                      error={errors.companyPic}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="space-y-6">
                    <div>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-slate-900">
                          Company Image Preview
                        </h3>
                        <p className="text-xs text-slate-500">
                          Paste a public image link to preview the company picture
                          before saving.
                        </p>
                      </div>

                      <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
                        {hasValidCompanyPicPreview && !isPreviewBroken ? (
                          <img
                            src={companyPicPreview}
                            alt="Company preview"
                            className="h-56 w-full object-contain"
                            onError={() => setIsPreviewBroken(true)}
                          />
                        ) : (
                          <p className="px-6 text-center text-sm text-slate-500">
                            {companyPicPreview && !hasValidCompanyPicPreview
                              ? "Enter a valid http:// or https:// image URL to see a preview."
                              : companyPicPreview && isPreviewBroken
                                ? "The image could not be loaded from that URL."
                                : "The company picture preview will appear here."}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="mb-3">
                        <h3 className="text-sm font-semibold text-slate-900">Company Address</h3>
                        <p className="text-xs text-slate-500">
                          Keep the address aligned with your `companies` table fields.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <OrdinaryInput
                          label="Block No"
                          register={register("blockNo", {
                            maxLength: { value: 100, message: "Max 100 characters" },
                          })}
                          error={errors.blockNo}
                        />

                        <OrdinaryInput
                          label="ZIP"
                          register={register("zip", {
                            maxLength: { value: 20, message: "Max 20 characters" },
                          })}
                          error={errors.zip}
                        />

                        <OrdinaryInput
                          label="City"
                          register={register("city", {
                            maxLength: { value: 150, message: "Max 150 characters" },
                          })}
                          error={errors.city}
                        />

                        <OrdinaryInput
                          label="Province"
                          register={register("province", {
                            maxLength: { value: 150, message: "Max 150 characters" },
                          })}
                          error={errors.province}
                        />

                        <OrdinaryInput
                          label="Country"
                          register={register("country", {
                            maxLength: { value: 150, message: "Max 150 characters" },
                          })}
                          error={errors.country}
                        />
                      </div>
                    </div>
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
                    setIsPreviewBroken(false);
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
