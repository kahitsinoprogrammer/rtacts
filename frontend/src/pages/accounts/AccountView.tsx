import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import OrdinaryInput from "../../components/OrdinaryInput";

type Account = {
  user_id?: string | null;
  UserID?: string | null;
  username?: string | null;
  Username?: string | null;
  email?: string | null;
  Email?: string | null;
  first_name?: string | null;
  FirstName?: string | null;
  last_name?: string | null;
  LastName?: string | null;
  middle_name?: string | null;
  MiddleName?: string | null;
  date_of_birth?: string | null;
  DateOfBirth?: string | null;
  user_type?: string | null;
  UserType?: string | null;
  contact_no?: string | null;
  ContactNo?: string | null;
  status?: string | null;
  Status?: string | null;
  date_registered?: string | null;
  DateRegistered?: string | null;
};

type AccountFormValues = {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  contactNo: string;
  isActive: string;
};

const EMPTY_FORM: AccountFormValues = {
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  middleName: "",
  dateOfBirth: "",
  contactNo: "",
  isActive: "true",
};

const toStr = (value: unknown) => {
  if (value === null || value === undefined) return "";
  return String(value);
};

const formatName = (account: Account) => {
  const firstName = toStr(account.first_name ?? account.FirstName).trim();
  const middleName = toStr(account.middle_name ?? account.MiddleName).trim();
  const lastName = toStr(account.last_name ?? account.LastName).trim();

  return [lastName, firstName, middleName].filter(Boolean).join(", ") || "-";
};

const formatDate = (value: unknown) => {
  const raw = toStr(value).trim();
  if (!raw) return "-";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const getAccountId = (account: Account) => account.user_id ?? account.UserID ?? "";

const fetchAccounts = async () => {
  const res = await fetch("http://localhost:8080/accounts", {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load users");
  }

  const data = await res.json();
  const accountList = Array.isArray(data) ? data : data?.data;
  return Array.isArray(accountList) ? accountList : [];
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

export default function AccountView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updateError, setUpdateError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    defaultValues: EMPTY_FORM,
  });

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setIsLoading(true);
        setError("");
        const accountList = await fetchAccounts();
        setAccounts(accountList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
        setAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAccounts();
  }, []);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const mapped = accounts.map((account) => {
      const username = toStr(account.username ?? account.Username) || "-";
      const email = toStr(account.email ?? account.Email) || "-";
      const userType = toStr(account.user_type ?? account.UserType) || "-";
      const contactNo = toStr(account.contact_no ?? account.ContactNo) || "-";
      const status = toStr(account.status ?? account.Status) || "-";
      const dateRegistered = formatDate(
        account.date_registered ?? account.DateRegistered,
      );
      const fullName = formatName(account);

      return {
        key: getAccountId(account) || `${username}-${email}-${dateRegistered}`,
        account,
        username,
        fullName,
        email,
        userType,
        contactNo,
        status,
        dateRegistered,
      };
    });

    if (!keyword) return mapped;

    return mapped.filter((item) =>
      `${item.username} ${item.fullName} ${item.email} ${item.userType} ${item.contactNo} ${item.status}`
        .toLowerCase()
        .includes(keyword),
    );
  }, [accounts, search]);

  const openModifyModal = (account: Account) => {
    setSelectedAccount(account);
    setUpdateError("");
    reset({
      username: toStr(account.username ?? account.Username),
      email: toStr(account.email ?? account.Email),
      firstName: toStr(account.first_name ?? account.FirstName),
      lastName: toStr(account.last_name ?? account.LastName),
      middleName: toStr(account.middle_name ?? account.MiddleName),
      dateOfBirth: toStr(account.date_of_birth ?? account.DateOfBirth),
      contactNo: toStr(account.contact_no ?? account.ContactNo),
      isActive:
        toStr(account.status ?? account.Status).trim().toLowerCase() === "inactive"
          ? "false"
          : "true",
    });
    setIsModalOpen(true);
  };

  const closeModifyModal = () => {
    setIsModalOpen(false);
    setSelectedAccount(null);
    setUpdateError("");
    reset(EMPTY_FORM);
  };

  const handleUpdateAccount = async (values: AccountFormValues) => {
    const accountId = selectedAccount ? getAccountId(selectedAccount) : "";
    if (!accountId) {
      setUpdateError("Missing account identifier.");
      return;
    }

    const payload = {
      username: values.username.trim(),
      email: values.email.trim(),
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      middle_name: values.middleName.trim() || null,
      date_of_birth: values.dateOfBirth.trim() || null,
      contact_no: values.contactNo.trim() || null,
      is_active: values.isActive === "true",
    };

    try {
      setUpdateError("");

      const res = await fetch(`http://localhost:8080/accounts/${accountId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to update user"));
      }

      const accountList = await fetchAccounts();
      setAccounts(accountList);
      alert("User updated successfully.");
      closeModifyModal();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">View All Users</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search and browse user accounts in your company.
          </p>
        </div>

        <div className="px-6 py-5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, full name, email, user type, or status..."
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>

        <div className="px-6 pb-6">
          {isLoading && <p className="text-sm text-slate-600">Loading users...</p>}

          {!isLoading && error && (
            <p className="text-sm text-rose-600">{error}</p>
          )}

          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-700">
                    <th className="px-3 py-2 font-medium">Username</th>
                    <th className="px-3 py-2 font-medium">Full Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">User Type</th>
                    <th className="px-3 py-2 font-medium">Contact No.</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Date Registered</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={8}>
                        No users found.
                      </td>
                    </tr>
                  )}

                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-900">{row.username}</td>
                      <td className="px-3 py-2 text-slate-700">{row.fullName}</td>
                      <td className="px-3 py-2 text-slate-700">{row.email}</td>
                      <td className="px-3 py-2 text-slate-700">{row.userType}</td>
                      <td className="px-3 py-2 text-slate-700">{row.contactNo}</td>
                      <td className="px-3 py-2 text-slate-700">{row.status}</td>
                      <td className="px-3 py-2 text-slate-700">
                        {row.dateRegistered}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openModifyModal(row.account)}
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

      {isModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Modify User</h3>
            </div>

            <form onSubmit={handleSubmit(handleUpdateAccount)}>
              <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
                <OrdinaryInput
                  label="Username"
                  register={register("username", {
                    required: "Username is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Username is required",
                    maxLength: { value: 100, message: "Max 100 characters" },
                  })}
                  error={errors.username}
                />

                <OrdinaryInput
                  label="Email"
                  register={register("email", {
                    required: "Email is required",
                    validate: (value) => {
                      if (!value.trim()) return "Email is required";
                      return (
                        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ||
                        "Invalid email"
                      );
                    },
                    maxLength: { value: 255, message: "Max 255 characters" },
                  })}
                  error={errors.email}
                />

                <OrdinaryInput
                  label="First Name"
                  register={register("firstName", {
                    required: "First name is required",
                    validate: (value) =>
                      value.trim().length > 0 || "First name is required",
                    maxLength: { value: 100, message: "Max 100 characters" },
                  })}
                  error={errors.firstName}
                />

                <OrdinaryInput
                  label="Last Name"
                  register={register("lastName", {
                    required: "Last name is required",
                    validate: (value) =>
                      value.trim().length > 0 || "Last name is required",
                    maxLength: { value: 100, message: "Max 100 characters" },
                  })}
                  error={errors.lastName}
                />

                <OrdinaryInput
                  label="Middle Name"
                  register={register("middleName", {
                    maxLength: { value: 100, message: "Max 100 characters" },
                  })}
                  error={errors.middleName}
                />

                <OrdinaryInput
                  label="Date of Birth"
                  type="date"
                  register={register("dateOfBirth")}
                  error={errors.dateOfBirth}
                />

                <OrdinaryInput
                  label="Contact No."
                  register={register("contactNo", {
                    maxLength: { value: 50, message: "Max 50 characters" },
                  })}
                  error={errors.contactNo}
                />

                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-slate-700">
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
