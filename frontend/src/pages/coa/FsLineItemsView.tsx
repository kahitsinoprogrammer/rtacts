import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "../../components/Modal";

type EncodedByUserType = {
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  UserID: string;
};

type AccountTypeObj = {
  ID: number;
  Type: string;
  DateCreated: string;
};

type AccountGroupObj = {
  ID: number;
  AccountType: number;
  Category: string;
  DateCreated: string;
  DateUpdated?: string;
  EncodedBy?: string;
  EncodedByUser?: EncodedByUserType;
  IsActive: boolean;

  AccountTypeObj?: AccountTypeObj;
};

type FsLineItem = {
  ID: number;

  AccountType: number;
  AccountGroup: number;

  FsAccountName: string;

  DateCreated: string;
  DateUpdated?: string;
  EncodedBy?: string;
  EncodedByUser?: EncodedByUserType;
  IsActive: boolean;

  AccountGroupObj?: AccountGroupObj;
};

type FormValues = {
  name: string; // FS line item name
  isInactive: boolean; // checkbox: "Mark as inactive"
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "";
  const [d, t] = iso.split("T");
  if (!t) return d;
  return `${d} ${t.split(".")[0]}`;
};

export default function FsLineItemsView() {
  const [fsLineItems, setFsLineItems] = useState<FsLineItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ modal state (same pattern as other tabs)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<FsLineItem | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, isValid },
  } = useForm<FormValues>({
    mode: "onChange",
    defaultValues: {
      name: "",
      isInactive: false,
    },
  });

  const loadFsLineItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/fs-line-items",
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) {
        alert(`FS Line Items Error: ${res.status}`);
        return;
      }

      const itemsData = (await res.json()) as FsLineItem[];
      setFsLineItems(Array.isArray(itemsData) ? itemsData : []);
    } catch (e) {
      alert("Error: failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFsLineItems();
  }, []);

  const rowsByType = useMemo(() => {
    const byType = new Map<
      number,
      {
        type: AccountTypeObj;
        groups: Map<
          number,
          { group: AccountGroupObj; lineItems: FsLineItem[] }
        >;
      }
    >();

    for (const item of fsLineItems) {
      const group = item.AccountGroupObj;
      const type = group?.AccountTypeObj;

      if (!group || !type) continue;

      if (!byType.has(type.ID)) {
        byType.set(type.ID, { type, groups: new Map() });
      }

      const t = byType.get(type.ID)!;

      if (!t.groups.has(group.ID)) {
        t.groups.set(group.ID, { group, lineItems: [] });
      }

      t.groups.get(group.ID)!.lineItems.push(item);
    }

    const typesArr = Array.from(byType.values()).sort(
      (a, b) => a.type.ID - b.type.ID
    );

    return typesArr.map((t) => ({
      type: t.type,
      groups: Array.from(t.groups.values())
        .sort((a, b) => a.group.ID - b.group.ID)
        .map((g) => ({
          group: g.group,
          lineItems: g.lineItems.sort((a, b) => a.ID - b.ID),
        })),
    }));
  }, [fsLineItems]);

  // ✅ open modal and preload form values
  const openModify = (li: FsLineItem) => {
    setSelected(li);

    reset({
      name: li.FsAccountName ?? "",
      isInactive: !li.IsActive, // checked => inactive => IsActive false
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelected(null);
    reset({ name: "", isInactive: false });
  };

const onSubmit = handleSubmit(async (data) => {
  if (!selected) return;

  const payload = {
    id: selected.ID,
    lineItem: data.name.trim(), // ✅ change to the exact controller key if it’s not "lineItem"
    isActive: !data.isInactive, // ✅ checkbox logic preserved
  };

  try {
    const res = await fetch(
      `http://localhost:8080/chart-of-accounts/fs-line-items/${payload.id}/deactivate`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineItem: payload.lineItem, // ✅ { lineItem, isActive }
          isActive: payload.isActive, // ✅ { lineItem, isActive }
        }),
      }
    );

    if (!res.ok) {
      let errMsg = "Invalid input";
      try {
        const errData = await res.json();
        errMsg = errData?.error || errMsg;
      } catch {}
      alert(errMsg);
      return;
    }

    // Try to read optional success message (e.g. "no changes made")
    let successMsg = "Saved successfully";
    try {
      const okData = await res.json();
      if (okData?.message === "no changes made") successMsg = "No changes made";
    } catch {
      // no body is fine
    }

    alert(successMsg);

    await loadFsLineItems(); // ✅ reload list (use your real loader name)
    closeModal();
  } catch (e) {
    alert("Failed to save FS line item");
  }
});



  return (
    <>
      <div className="max-w-5xl space-y-4">
        <h2 className="text-base font-semibold text-slate-800">
          FS Line Items
        </h2>

        <div className="rounded-md border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Loading...</div>
          ) : rowsByType.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              No FS line items found (or missing preloads).
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-700">
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Account Type
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Account Group
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      FS Line Item
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rowsByType.flatMap(({ type, groups }) => {
                    if (groups.length === 0) {
                      return (
                        <tr
                          key={`type-${type.ID}-empty`}
                          className="hover:bg-slate-50"
                        >
                          <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                            {type.Type}
                          </td>
                          <td className="border-b border-slate-200 px-4 py-3 text-slate-400">
                            No groups
                          </td>
                          <td className="border-b border-slate-200 px-4 py-3 text-slate-400">
                            —
                          </td>
                          <td className="border-b border-slate-200 px-4 py-3 text-right text-slate-400">
                            —
                          </td>
                        </tr>
                      );
                    }

                    return groups.flatMap(({ group, lineItems }) => {
                      const lineRows = lineItems.length ? lineItems : [null];

                      return lineRows.map((li) => (
                        <tr
                          key={`${type.ID}-${group.ID}-${li ? li.ID : "empty"}`}
                          className="hover:bg-slate-50"
                        >
                          <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                            {type.Type}
                            <div className="mt-1 text-xs text-slate-500">
                              Type ID: {type.ID}
                            </div>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 align-top font-medium text-slate-900">
                            <div className="flex flex-col">
                              <span>{group.Category}</span>
                              <span className="mt-1 text-xs text-slate-500">
                                Group ID: {group.ID}
                              </span>
                              <span className="mt-1 text-xs text-slate-500">
                                Created: {formatDateTime(group.DateCreated)}
                              </span>
                              {group.EncodedByUser && (
                                <span className="text-xs text-slate-500">
                                  Encoded by: {group.EncodedByUser.LastName},{" "}
                                  {group.EncodedByUser.FirstName}{" "}
                                  {group.EncodedByUser.MiddleName ?? ""}
                                </span>
                              )}
                              <span className="mt-1 text-xs text-slate-500">
                                Active:{" "}
                                <span
                                  className={
                                    group.IsActive ? "" : "text-red-600"
                                  }
                                >
                                  {group.IsActive ? "Yes" : "No"}
                                </span>
                              </span>
                            </div>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 align-top">
                            {li ? (
                              <div className="flex flex-col">
                                <span className="text-slate-900">
                                  {li.FsAccountName}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  Item ID: {li.ID}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  Created: {formatDateTime(li.DateCreated)}
                                </span>
                                {li.EncodedByUser && (
                                  <span className="text-xs text-slate-500">
                                    Encoded by: {li.EncodedByUser.LastName},{" "}
                                    {li.EncodedByUser.FirstName}{" "}
                                    {li.EncodedByUser.MiddleName ?? ""}
                                  </span>
                                )}
                                <span className="mt-1 text-xs text-slate-500">
                                  Active:{" "}
                                  <span
                                    className={
                                      li.IsActive ? "" : "text-red-600"
                                    }
                                  >
                                    {li.IsActive ? "Yes" : "No"}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                No FS line items
                              </span>
                            )}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 align-top text-right">
                            {li ? (
                              <button
                                type="button"
                                onClick={() => openModify(li)}
                                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                                data-id={li.ID}
                              >
                                Modify
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ));
                    });
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Modal (same concept) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          selected
            ? `Modify FS Line Item (ID: ${selected.ID})`
            : "Modify FS Line Item"
        }
        footer={
          <>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="fsLineItemForm"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={!isValid || isSubmitting || !selected}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form id="fsLineItemForm" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              FS Line Item Name
            </label>

            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Enter FS line item name"
              {...register("name", {
                required: "Name is required",
                setValueAs: (v) => (typeof v === "string" ? v : ""),
              })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="inactive"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              {...register("isInactive")}
            />
            <label htmlFor="inactive" className="text-sm text-slate-700">
              Mark as inactive
            </label>
          </div>
          {/* ✅ read-only context card (Type/Group/FS Line) */}
          {selected && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div>
                <span className="font-medium text-slate-700">Type:</span>{" "}
                {selected.AccountGroupObj?.AccountTypeObj?.Type ?? "—"}
              </div>

              <div className="mt-1">
                <span className="font-medium text-slate-700">Group:</span>{" "}
                {selected.AccountGroupObj?.Category ?? "—"}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
