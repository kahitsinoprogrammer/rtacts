import { useEffect, useMemo, useState } from "react";

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
  vatable?: boolean;
  unit_price?: number;
  product?: Product | null;
};

type Invoice = {
  id?: string;
  customer?: string;
  created_at?: string;
  approved_date?: string | null;
  status?: string;
  PreparedByUser?: PreparedByUser | null;
  items?: InvoiceItem[];
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
  if (normalized.includes("awaiting") || normalized.includes("pending")) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (normalized.includes("rejected") || normalized.includes("cancel")) {
    return "bg-rose-100 text-rose-800 ring-rose-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
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

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedItemsByInvoice, setExpandedItemsByInvoice] = useState<
    Record<string, boolean>
  >({});

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
      const productText = (invoice.items || [])
        .map((item) => item.product?.product_name || item.product_id || "")
        .join(" ");

      return `${id} ${customer} ${status} ${productText}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [invoices, search]);

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
            placeholder="Search by invoice ID, customer, status, or product..."
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
            const status = normalizeStatus(invoice.status);
            const createdAt = toDateDisplay(invoice.created_at);
            const approvedDate = toDateDisplay(invoice.approved_date);
            const preparedByName = getPreparedByName(invoice.PreparedByUser);
            const items = invoice.items || [];
            const invoiceKey = String(invoice.id || `${id}-${index}`);
            const isExpanded = Boolean(expandedItemsByInvoice[invoiceKey]);
            const displayedItems = isExpanded ? items : items.slice(0, 2);
            const invoiceTotal = items.reduce(
              (sum, item) => sum + toNumber(item.total_amount ?? item.amount),
              0,
            );

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
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusPillClass(invoice.status)}`}
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
                    {invoiceTotal.toFixed(2)}
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
                            <p>Vatable: {item.vatable ? "Yes" : "No"}</p>
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
