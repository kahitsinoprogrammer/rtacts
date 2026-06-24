import { useEffect, useMemo, useState } from "react";

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
  user_type?: string | null;
  UserType?: string | null;
  contact_no?: string | null;
  ContactNo?: string | null;
  status?: string | null;
  Status?: string | null;
  date_registered?: string | null;
  DateRegistered?: string | null;
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

export default function AccountView() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setIsLoading(true);
        setError("");

        const res = await fetch("http://localhost:8080/accounts", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load users");
        }

        const data = await res.json();
        const accountList = Array.isArray(data) ? data : data?.data;
        setAccounts(Array.isArray(accountList) ? accountList : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
        setAccounts([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccounts();
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
        key:
          account.user_id ??
          account.UserID ??
          `${username}-${email}-${dateRegistered}`,
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
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slate-500" colSpan={7}>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
