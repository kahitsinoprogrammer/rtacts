import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/Modal";

type Supplier = {
  supplier_name?: string | null;
  email?: string | null;
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
  RejectRemarks?: string | null;
  reject_remarks?: string | null;
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

const toStr = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value);
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
  if (normalized.includes("awaiting") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (normalized.includes("rejected") || normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

const canDecideVoucher = (status?: string): boolean => {
  const normalized = (status || "").trim().toLowerCase();
  return normalized === "awaiting approval" || normalized === "pending";
};

const canDownloadVoucher = (status?: string): boolean =>
  (status || "").trim().toLowerCase() === "approved";

const getVoucherId = (voucher: CheckVoucher): string =>
  String(voucher.ID || voucher.id || "");

const getRejectRemarks = (voucher: CheckVoucher): string =>
  toStr(voucher.RejectRemarks ?? voucher.reject_remarks).trim();

const getErrorMessage = async (response: Response, fallback: string) => {
  const raw = (await response.text()).trim();
  if (!raw) return `${fallback} (${response.status})`;

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    return `${fallback} (${response.status}: ${raw})`;
  }

  return `${fallback} (${response.status})`;
};

export default function CVlist() {
  const [vouchers, setVouchers] = useState<CheckVoucher[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingVoucherId, setUpdatingVoucherId] = useState<string | null>(null);
  const [downloadingVoucherId, setDownloadingVoucherId] = useState<string | null>(
    null,
  );
  const [expandedItemsByVoucher, setExpandedItemsByVoucher] = useState<
    Record<string, boolean>
  >({});
  const [rejectTarget, setRejectTarget] = useState<CheckVoucher | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [rejectError, setRejectError] = useState("");

  const closeRejectModal = () => {
    setRejectTarget(null);
    setRejectRemarks("");
    setRejectError("");
  };

  const updateVoucherStatus = async (
    voucher: CheckVoucher,
    status: "Approved" | "Rejected",
    remarks?: string,
  ) => {
    const voucherId = getVoucherId(voucher);
    if (!voucherId) return false;

    try {
      setUpdatingVoucherId(voucherId);
      setError("");
      setRejectError("");

      const payload =
        status === "Rejected"
          ? { status, reject_remarks: remarks?.trim() || null }
          : { status };

      const response = await fetch(
        `http://localhost:8080/check-vouchers/${voucherId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            `Failed to ${status.toLowerCase()} check voucher`,
          ),
        );
      }

      const nextApprovedDate =
        status === "Approved" ? new Date().toISOString() : null;
      const nextRejectRemarks = status === "Rejected" ? remarks?.trim() || null : null;

      setVouchers((prev) =>
        prev.map((item) => {
          const itemId = getVoucherId(item);
          if (itemId !== voucherId) return item;
          return {
            ...item,
            Status: status,
            status: status,
            ApprovedDate: nextApprovedDate,
            approved_date: nextApprovedDate,
            RejectRemarks: nextRejectRemarks,
            reject_remarks: nextRejectRemarks,
          };
        }),
      );

      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${status.toLowerCase()} check voucher`;

      if (status === "Rejected") {
        setRejectError(message);
      } else {
        setError(message);
      }
      return false;
    } finally {
      setUpdatingVoucherId(null);
    }
  };

  const downloadVoucherExcel = async (voucher: CheckVoucher) => {
    const voucherId = getVoucherId(voucher);
    if (!voucherId) return;

    try {
      setDownloadingVoucherId(voucherId);
      setError("");

      const response = await fetch(
        `http://localhost:8080/check-vouchers/${voucherId}/excel`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(response, "Failed to download check voucher"),
        );
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const fileNameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const fileName = fileNameMatch?.[1] || `${voucherId}.xlsx`;
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to download check voucher",
      );
    } finally {
      setDownloadingVoucherId(null);
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

    void fetchVouchers();
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
      const rejectRemarksText = getRejectRemarks(voucher);

      return `${id} ${supplierName} ${supplierEmail} ${status} ${rejectRemarksText}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [search, vouchers]);

  const submitReject = async () => {
    if (!rejectTarget) return;

    const trimmedRemarks = rejectRemarks.trim();
    if (!trimmedRemarks) {
      setRejectError("Reject remarks are required.");
      return;
    }

    const success = await updateVoucherStatus(
      rejectTarget,
      "Rejected",
      trimmedRemarks,
    );
    if (success) {
      closeRejectModal();
    }
  };

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
            placeholder="Search by CV ID, supplier, email, status, or remarks..."
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
            const id = getVoucherId(voucher) || "-";
            const rawStatus = voucher.Status || voucher.status;
            const status = normalizeStatus(rawStatus);
            const createdAt = toDateDisplay(voucher.CreatedAt || voucher.created_at);
            const approvedDate = toDateDisplay(
              voucher.ApprovedDate || voucher.approved_date,
            );
            const supplier = voucher.Supplier || voucher.supplier;
            const preparedBy = voucher.PreparedByUser;
            const preparedByName = preparedBy
              ? `${preparedBy.LastName || ""}${preparedBy.LastName && preparedBy.FirstName ? ", " : ""}${preparedBy.FirstName || ""}${preparedBy.MiddleName ? ` ${preparedBy.MiddleName}` : ""}`.trim()
              : "";
            const items = (voucher.Items || voucher.items) ?? [];
            const voucherKey = String(voucher.ID || voucher.id || `${id}-${index}`);
            const isExpanded = Boolean(expandedItemsByVoucher[voucherKey]);
            const displayedItems = isExpanded ? items : items.slice(0, 2);
            const decisionPending = canDecideVoucher(rawStatus);
            const downloadReady = canDownloadVoucher(rawStatus);
            const rejectRemarksText = getRejectRemarks(voucher);

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
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusPillClass(rawStatus)}`}
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
                  {approvedDate !== "-" && (
                    <p>
                      <span className="font-medium text-slate-900">Approved on:</span>{" "}
                      {approvedDate}
                    </p>
                  )}
                </div>

                {rejectRemarksText && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    <span className="font-medium">Reject remarks:</span> {rejectRemarksText}
                  </div>
                )}

                <div className="mt-3 border-t border-slate-200 pt-3">
                  <p className="mb-2 text-sm font-medium text-slate-900">Line Items</p>
                  {items.length === 0 && <p className="text-sm text-slate-500">No line items.</p>}
                  {items.length > 0 && (
                    <ul className="space-y-2">
                      {displayedItems.map((item, itemIndex) => {
                        return (
                          <li
                            key={item.ID || item.id || `line-${itemIndex}`}
                            className="rounded-md bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200"
                          >
                            <p className="mb-1 font-medium text-slate-900">
                              Line {item.LineNo || item.line_no || itemIndex + 1}
                            </p>
                            <p>Account: {item.AccountID ?? item.account_id ?? "-"}</p>
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
                    onClick={() => void updateVoucherStatus(voucher, "Approved")}
                    disabled={
                      updatingVoucherId === getVoucherId(voucher) || !decisionPending
                    }
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectTarget(voucher);
                      setRejectRemarks(rejectRemarksText);
                      setRejectError("");
                    }}
                    disabled={
                      updatingVoucherId === getVoucherId(voucher) || !decisionPending
                    }
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadVoucherExcel(voucher)}
                    disabled={
                      downloadingVoucherId === getVoucherId(voucher) || !downloadReady
                    }
                    className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingVoucherId === getVoucherId(voucher)
                      ? "Downloading..."
                      : "Download Excel"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        isOpen={Boolean(rejectTarget)}
        onClose={closeRejectModal}
        title="Reject Check Voucher"
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeRejectModal}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              disabled={Boolean(updatingVoucherId)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitReject()}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              disabled={Boolean(updatingVoucherId)}
            >
              {updatingVoucherId && rejectTarget && updatingVoucherId === getVoucherId(rejectTarget)
                ? "Rejecting..."
                : "Reject"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Add the reason for rejecting this check voucher. This will be saved and shown in the list.
          </p>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-slate-700">
              Reject Remarks
            </label>
            <textarea
              rows={4}
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Enter rejection remarks..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          {rejectError && <p className="text-sm text-rose-600">{rejectError}</p>}
        </div>
      </Modal>
    </div>
  );
}
