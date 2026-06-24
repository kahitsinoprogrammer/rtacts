import { useEffect, useMemo, useState } from "react";

type Supplier = {
  supplier_name?: string | null;
  email?: string | null;
};

type Customer = {
  customer_id?: string | null;
  customer_name?: string | null;
};

type PreparedByUser = {
  FirstName?: string | null;
  LastName?: string | null;
  MiddleName?: string | null;
  Username?: string | null;
};

type CheckVoucherItem = {
  ID?: string;
  id?: string;
  AccountID?: number | null;
  account_id?: number | null;
  CustomerID?: string | null;
  customer_id?: string | null;
  Customer?: Customer | null;
  customer?: Customer | null;
  Debit?: number;
  debit?: number;
  Credit?: number;
  credit?: number;
  LineNo?: number;
  line_no?: number;
};

type CheckVoucher = {
  ID?: string;
  id?: string;
  Status?: string;
  status?: string;
  CreatedAt?: string;
  created_at?: string;
  ApprovedDate?: string | null;
  approved_date?: string | null;
  Supplier?: Supplier | null;
  supplier?: Supplier | null;
  PreparedByUser?: PreparedByUser | null;
  Items?: CheckVoucherItem[];
  items?: CheckVoucherItem[];
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDateDisplay = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const normalizeStatus = (status?: string): string => {
  if (!status) return "Unknown";
  return status
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const statusPillClass = (status?: string): string => {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("approved")) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (normalized.includes("pending")) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (normalized.includes("rejected") || normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

export default function CVlist() {
  const [vouchers, setVouchers] = useState<CheckVoucher[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingVoucherId, setUpdatingVoucherId] = useState<string | null>(null);
  const [expandedItemsByVoucher, setExpandedItemsByVoucher] = useState<Record<string, boolean>>({});

  const updateVoucherStatus = async (voucher: CheckVoucher, status: "Approved" | "Rejected") => {
    const voucherId = voucher.ID || voucher.id;
    if (!voucherId) return;

    try {
      setUpdatingVoucherId(voucherId);
      setError("");

      const response = await fetch(
        `http://localhost:8080/check-vouchers/${voucherId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ status }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to ${status.toLowerCase()} check voucher`);
      }

      setVouchers((prev) =>
        prev.map((item) => {
          const itemId = item.ID || item.id;
          if (itemId !== voucherId) return item;
          return {
            ...item,
            Status: status,
            status,
          };
        }),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${status.toLowerCase()} check voucher`,
      );
    } finally {
      setUpdatingVoucherId(null);
    }
  };

  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        setIsLoading(true);
        setError("");

        const vouchersRes = await fetch("http://localhost:8080/check-vouchers", {
          method: "GET",
          credentials: "include",
        });

        if (!vouchersRes.ok) {
          throw new Error("Failed to load check vouchers");
        }

        const vouchersData = await vouchersRes.json();

        const list = Array.isArray(vouchersData) ? vouchersData : vouchersData?.data;

        setVouchers(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load check vouchers",
        );
        setVouchers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVouchers();
  }, []);

  const filteredVouchers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return vouchers;

    return vouchers.filter((voucher) => {
      const supplier = voucher.Supplier || voucher.supplier;
      const id = voucher.ID || voucher.id || "";
      const status = voucher.Status || voucher.status || "";
      const supplierName = supplier?.supplier_name || "";
      const supplierEmail = supplier?.email || "";

      return `${id} ${supplierName} ${supplierEmail} ${status}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [search, vouchers]);

  return (
    <div className="w-full p-4 sm:p-6">
      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Check Voucher List</h2>
            <p className="text-sm text-slate-500">
              {isLoading ? "Loading vouchers..." : `${filteredVouchers.length} result(s)`}
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by CV ID, supplier, email, or status..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:max-w-md"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-600">Loading check vouchers...</p>}
      {!isLoading && error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!isLoading && !error && filteredVouchers.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No check vouchers found.
        </div>
      )}

      {!isLoading && !error && filteredVouchers.length > 0 && (
        <ul className="space-y-4">
          {filteredVouchers.map((voucher, index) => {
            const id = voucher.ID || voucher.id || "-";
            const status = normalizeStatus(voucher.Status || voucher.status);
            const createdAt = toDateDisplay(voucher.CreatedAt || voucher.created_at);
            const supplier = voucher.Supplier || voucher.supplier;
            const preparedBy = voucher.PreparedByUser;
            const preparedByName = preparedBy
              ? `${preparedBy.LastName || ""}${preparedBy.LastName && preparedBy.FirstName ? ", " : ""}${preparedBy.FirstName || ""}${preparedBy.MiddleName ? ` ${preparedBy.MiddleName}` : ""}`.trim()
              : "";
            const items = (voucher.Items || voucher.items) ?? [];
            const voucherKey = String(voucher.ID || voucher.id || `${id}-${index}`);
            const isExpanded = Boolean(expandedItemsByVoucher[voucherKey]);
            const displayedItems = isExpanded ? items : items.slice(0, 2);

            return (
              <li
                key={voucherKey}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">CV ID</p>
                    <p className="text-sm font-semibold text-slate-900">{id}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusPillClass(voucher.Status || voucher.status)}`}
                  >
                    {status}
                  </span>
                </div>

                <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2 md:gap-x-6">
                  <p>
                    <span className="font-medium text-slate-900">Supplier:</span>{" "}
                    {supplier?.supplier_name || "-"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Email:</span>{" "}
                    {supplier?.email || "-"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Created:</span> {createdAt}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Prepared by:</span>{" "}
                    {preparedByName || preparedBy?.Username || "-"}
                  </p>
                </div>

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="mb-2 text-sm font-medium text-slate-900">Line Items</p>
                  {items.length === 0 && <p className="text-sm text-slate-500">No line items.</p>}
                  {items.length > 0 && (
                    <ul className="space-y-2">
                      {displayedItems.map((item, itemIndex) => {
                        const customer = item.Customer || item.customer;
                        const customerId = item.CustomerID || item.customer_id || "";
                        const customerName = customer?.customer_name || customerId || "-";

                        return (
                          <li
                            key={item.ID || item.id || `line-${itemIndex}`}
                            className="rounded-md bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200"
                          >
                            <p className="mb-1 font-medium text-slate-900">
                              Line {item.LineNo || item.line_no || itemIndex + 1}
                            </p>
                            <p>Account: {item.AccountID ?? item.account_id ?? "-"}</p>
                            <p>Customer: {customerName}</p>
                            <p>
                              Debit: {toNumber(item.Debit ?? item.debit).toFixed(2)} | Credit:{" "}
                              {toNumber(item.Credit ?? item.credit).toFixed(2)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItemsByVoucher((prev) => ({
                          ...prev,
                          [voucherKey]: !isExpanded,
                        }))
                      }
                      className="mt-2 text-xs font-medium text-blue-700 transition hover:text-blue-800"
                    >
                      {isExpanded ? "See less" : `See more (${items.length - 2} more)`}
                    </button>
                  )}
                </div>

                <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={() => updateVoucherStatus(voucher, "Approved")}
                    disabled={updatingVoucherId === (voucher.ID || voucher.id)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => updateVoucherStatus(voucher, "Rejected")}
                    disabled={updatingVoucherId === (voucher.ID || voucher.id)}
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
