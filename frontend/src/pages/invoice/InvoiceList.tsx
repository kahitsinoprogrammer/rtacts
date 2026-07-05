import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../components/Modal";
import {
  invoiceTaxTypeLabels,
  normalizeInvoiceTaxType,
} from "./taxTypes";

type PreparedByUser = {
  FirstName?: string | null;
  LastName?: string | null;
  MiddleName?: string | null;
  Username?: string | null;
};

type Product = {
  product_name?: string | null;
  unit_measurement?: string | null;
};

type InvoiceItem = {
  id?: string;
  product_id?: string;
  line_no?: number;
  quantity?: number;
  amount?: number;
  total_amount?: number;
  tax_type?: string | null;
  vatable?: boolean | string | null;
  unit_price?: number;
  product?: Product | null;
};

type Invoice = {
  id?: string;
  customer?: string;
  total_amount?: number;
  created_at?: string;
  approved_date?: string | null;
  status?: string;
  RejectRemarks?: string | null;
  reject_remarks?: string | null;
  PreparedByUser?: PreparedByUser | null;
  items?: InvoiceItem[];
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toStr = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value);
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
  if (normalized.includes("awaiting") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (normalized.includes("rejected") || normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

const canDecideInvoice = (status?: string): boolean => {
  const normalized = (status || "").trim().toLowerCase();
  return normalized === "awaiting approval" || normalized === "pending";
};

const getInvoiceId = (invoice: Invoice): string => String(invoice.id || "");

const getRejectRemarks = (invoice: Invoice): string =>
  toStr(invoice.RejectRemarks ?? invoice.reject_remarks).trim();

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

const getPreparedByName = (preparedBy?: PreparedByUser | null): string => {
  if (!preparedBy) return "";
  const name = `${preparedBy.LastName || ""}${
    preparedBy.LastName && preparedBy.FirstName ? ", " : ""
  }${preparedBy.FirstName || ""}${
    preparedBy.MiddleName ? ` ${preparedBy.MiddleName}` : ""
  }`.trim();
  return name || preparedBy.Username || "";
};

const getTaxTypeLabel = (item: InvoiceItem): string => {
  const normalized = normalizeInvoiceTaxType(item.tax_type ?? item.vatable);
  return normalized ? invoiceTaxTypeLabels[normalized] : "-";
};

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState<string | null>(null);
  const [expandedItemsByInvoice, setExpandedItemsByInvoice] = useState<
    Record<string, boolean>
  >({});
  const [rejectTarget, setRejectTarget] = useState<Invoice | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [rejectError, setRejectError] = useState("");

  const closeRejectModal = () => {
    setRejectTarget(null);
    setRejectRemarks("");
    setRejectError("");
  };

  const updateInvoiceStatus = async (
    invoice: Invoice,
    status: "Approved" | "Rejected",
    remarks?: string,
  ) => {
    const invoiceId = getInvoiceId(invoice);
    if (!invoiceId) return false;

    try {
      setUpdatingInvoiceId(invoiceId);
      setError("");
      setRejectError("");

      const payload =
        status === "Rejected"
          ? { status, reject_remarks: remarks?.trim() || null }
          : { status };

      const response = await fetch(
        `http://localhost:8080/invoices/${invoiceId}/status`,
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
            `Failed to ${status.toLowerCase()} invoice`,
          ),
        );
      }

      const nextApprovedDate =
        status === "Approved" ? new Date().toISOString() : null;
      const nextRejectRemarks = status === "Rejected" ? remarks?.trim() || null : null;

      setInvoices((prev) =>
        prev.map((item) =>
          getInvoiceId(item) !== invoiceId
            ? item
            : {
                ...item,
                status,
                approved_date: nextApprovedDate,
                RejectRemarks: nextRejectRemarks,
                reject_remarks: nextRejectRemarks,
              },
        ),
      );

      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${status.toLowerCase()} invoice`;

      if (status === "Rejected") {
        setRejectError(message);
      } else {
        setError(message);
      }
      return false;
    } finally {
      setUpdatingInvoiceId(null);
    }
  };

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setIsLoading(true);
        setError("");

        const res = await fetch("http://localhost:8080/invoices", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to load invoices");
        }

        const data = await res.json();
        const list = Array.isArray(data) ? data : data?.data;
        setInvoices(Array.isArray(list) ? list : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invoices");
        setInvoices([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return invoices;

    return invoices.filter((invoice) => {
      const id = invoice.id || "";
      const customer = invoice.customer || "";
      const status = invoice.status || "";
      const rejectRemarksText = getRejectRemarks(invoice);
      const productText = (invoice.items || [])
        .map(
          (item) =>
            `${item.product?.product_name || item.product_id || ""} ${getTaxTypeLabel(item)}`,
        )
        .join(" ");

      return `${id} ${customer} ${status} ${rejectRemarksText} ${productText}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [invoices, search]);

  const submitReject = async () => {
    if (!rejectTarget) return;

    const trimmedRemarks = rejectRemarks.trim();
    if (!trimmedRemarks) {
      setRejectError("Reject remarks are required.");
      return;
    }

    const success = await updateInvoiceStatus(
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
            <h2 className="text-xl font-semibold text-slate-900">Invoice List</h2>
            <p className="text-sm text-slate-500">
              {isLoading ? "Loading invoices..." : `${filteredInvoices.length} result(s)`}
            </p>
          </div>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by invoice ID, customer, status, remarks, or product..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:max-w-md"
          />
        </div>
      </div>

      {isLoading && <p className="text-sm text-slate-600">Loading invoices...</p>}
      {!isLoading && error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      {!isLoading && !error && filteredInvoices.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No invoices found.
        </div>
      )}

      {!isLoading && !error && filteredInvoices.length > 0 && (
        <ul className="space-y-4">
          {filteredInvoices.map((invoice, index) => {
            const id = invoice.id || "-";
            const rawStatus = invoice.status;
            const status = normalizeStatus(rawStatus);
            const createdAt = toDateDisplay(invoice.created_at);
            const approvedDate = toDateDisplay(invoice.approved_date);
            const preparedByName = getPreparedByName(invoice.PreparedByUser);
            const items = invoice.items || [];
            const invoiceKey = String(invoice.id || `${id}-${index}`);
            const isExpanded = Boolean(expandedItemsByInvoice[invoiceKey]);
            const displayedItems = isExpanded ? items : items.slice(0, 2);
            const decisionPending = canDecideInvoice(rawStatus);
            const rejectRemarksText = getRejectRemarks(invoice);

            return (
              <li
                key={invoiceKey}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Invoice ID
                    </p>
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
                    <span className="font-medium text-slate-900">Customer:</span>{" "}
                    {invoice.customer || "-"}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Total:</span>{" "}
                    {toNumber(invoice.total_amount).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Created:</span>{" "}
                    {createdAt}
                  </p>
                  <p>
                    <span className="font-medium text-slate-900">Prepared by:</span>{" "}
                    {preparedByName || "-"}
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
                  {items.length === 0 && (
                    <p className="text-sm text-slate-500">No line items.</p>
                  )}
                  {items.length > 0 && (
                    <ul className="space-y-2">
                      {displayedItems.map((item, itemIndex) => {
                        const productName =
                          item.product?.product_name || item.product_id || "-";
                        const unit = item.product?.unit_measurement || "";

                        return (
                          <li
                            key={item.id || `line-${itemIndex}`}
                            className="rounded-md bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200"
                          >
                            <p className="mb-1 font-medium text-slate-900">
                              Line {item.line_no || itemIndex + 1}
                            </p>
                            <p>Product: {productName}</p>
                            <p>
                              Quantity: {toNumber(item.quantity).toFixed(2)}
                              {unit ? ` ${unit}` : ""}
                            </p>
                            <p>
                              Unit Price: {toNumber(item.unit_price).toFixed(2)} |
                              Amount:{" "}
                              {toNumber(item.total_amount ?? item.amount).toFixed(2)}
                            </p>
                            <p>Tax Type: {getTaxTypeLabel(item)}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedItemsByInvoice((prev) => ({
                          ...prev,
                          [invoiceKey]: !isExpanded,
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
                    onClick={() => void updateInvoiceStatus(invoice, "Approved")}
                    disabled={
                      updatingInvoiceId === getInvoiceId(invoice) || !decisionPending
                    }
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingInvoiceId === getInvoiceId(invoice)
                      ? "Updating..."
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectTarget(invoice);
                      setRejectRemarks(rejectRemarksText);
                      setRejectError("");
                    }}
                    disabled={
                      updatingInvoiceId === getInvoiceId(invoice) || !decisionPending
                    }
                    className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingInvoiceId === getInvoiceId(invoice)
                      ? "Updating..."
                      : "Reject"}
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
        title="Reject Invoice"
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeRejectModal}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              disabled={Boolean(updatingInvoiceId)}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitReject()}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              disabled={Boolean(updatingInvoiceId)}
            >
              {updatingInvoiceId && rejectTarget && updatingInvoiceId === getInvoiceId(rejectTarget)
                ? "Rejecting..."
                : "Reject"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Add the reason for rejecting this invoice. This will be saved and shown in the list.
          </p>

          <div className="flex flex-col">
            <label className="block text-sm font-medium text-slate-700">
              Reject Remarks
            </label>
            <textarea
              rows={4}
              value={rejectRemarks}
              onChange={(event) => setRejectRemarks(event.target.value)}
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
