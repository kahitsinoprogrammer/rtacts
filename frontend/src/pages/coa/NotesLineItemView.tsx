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

type FsLineItemObj = {
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

type NotesLineItem = {
  ID: number;

  AccountType: number;
  AccountGroup: number;
  FsAccount: number;

  NotesDescription: string;
  CompanyID: string;
  EncodedBy: string;
  DateCreated: string;
  DateUpdated?: string;
  IsActive: boolean;

  EncodedByUser?: EncodedByUserType;
  FsAccountObj?: FsLineItemObj;
};

type FormValues = {
  name: string; // Notes line item description
  isInactive: boolean; // checkbox: "Mark as inactive"
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "";
  const [d, t] = iso.split("T");
  if (!t) return d;
  return `${d} ${t.split(".")[0]}`;
};

export default function NotesLineItemsView() {
  const [notesLineItems, setNotesLineItems] = useState<NotesLineItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<NotesLineItem | null>(null);

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

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/notes-line-items",
        { method: "GET", credentials: "include" }
      );

      if (!res.ok) {
        alert(`Notes Line Items Error: ${res.status}`);
        return;
      }

      const notesData = (await res.json()) as NotesLineItem[];
      setNotesLineItems(Array.isArray(notesData) ? notesData : []);
    } catch (e) {
      alert("Error: failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  /**
   * note -> FsAccountObj -> AccountGroupObj -> AccountTypeObj
   */
  const rowsByType = useMemo(() => {
    const byType = new Map<
      number,
      {
        type: AccountTypeObj;
        groups: Map<
          number,
          {
            group: AccountGroupObj;
            fsItems: Map<number, { fs: FsLineItemObj; notes: NotesLineItem[] }>;
          }
        >;
      }
    >();

    for (const note of notesLineItems) {
      const fs = note.FsAccountObj;
      const group = fs?.AccountGroupObj;
      const type = group?.AccountTypeObj;

      if (!fs || !group || !type) continue;

      if (!byType.has(type.ID)) {
        byType.set(type.ID, { type, groups: new Map() });
      }
      const t = byType.get(type.ID)!;

      if (!t.groups.has(group.ID)) {
        t.groups.set(group.ID, { group, fsItems: new Map() });
      }
      const g = t.groups.get(group.ID)!;

      if (!g.fsItems.has(fs.ID)) {
        g.fsItems.set(fs.ID, { fs, notes: [] });
      }
      g.fsItems.get(fs.ID)!.notes.push(note);
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
          fsLineItems: Array.from(g.fsItems.values())
            .sort((a, b) => a.fs.ID - b.fs.ID)
            .map((bundle) => ({
              lineItem: bundle.fs,
              notes: bundle.notes.sort((a, b) => a.ID - b.ID),
            })),
        })),
    }));
  }, [notesLineItems]);

  // ✅ open modal and preload form values
  const openModify = (note: NotesLineItem) => {
    setSelected(note);

    reset({
      name: note.NotesDescription ?? "",
      isInactive: !note.IsActive,
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelected(null);
    reset({ name: "", isInactive: false });
  };

  // ✅ Notes Line Item submit handler (same format as your other views)
  const onSubmit = handleSubmit(async (data) => {
    if (!selected) return;

    const payload = {
      id: selected.ID,
      lineItem: data.name.trim(), // ✅ matches controller JSON key: "lineItem"
      isActive: !data.isInactive, // ✅ checkbox logic preserved
    };

    try {
      const res = await fetch(
        `http://localhost:8080/chart-of-accounts/notes-line-items/${payload.id}/deactivate`,
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
        if (okData?.message === "no changes made")
          successMsg = "No changes made";
      } catch {
        // no body is fine
      }

      alert(successMsg);

      await load(); // ✅ reload list (your loader is named load())
      closeModal();
    } catch (e) {
      alert("Failed to save notes line item");
    }
  });

  return (
    <>
      <div className="max-w-5xl space-y-4">
        <h2 className="text-base font-semibold text-slate-800">
          Notes Line Items
        </h2>

        <div className="rounded-md border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Loading...</div>
          ) : rowsByType.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              No notes line items found (or missing preloads).
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
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Notes Line Item
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rowsByType.flatMap(({ type, groups }) =>
                    groups.flatMap(({ group, fsLineItems }) => {
                      const expanded = fsLineItems.flatMap((bundle) => {
                        const notes = bundle.notes?.length
                          ? bundle.notes
                          : [null];

                        return notes.map((note, noteIdx) => ({
                          lineItem: bundle.lineItem,
                          note,
                          key: `${type.ID}-${group.ID}-${bundle.lineItem.ID}-${
                            note ? note.ID : "empty"
                          }-${noteIdx}`,
                        }));
                      });

                      return expanded.map(({ lineItem, note, key }) => (
                        <tr key={key} className="hover:bg-slate-50">
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
                            <div className="flex flex-col">
                              <span className="text-slate-900">
                                {lineItem.FsAccountName}
                              </span>
                              <span className="mt-1 text-xs text-slate-500">
                                Item ID: {lineItem.ID}
                              </span>
                              <span className="mt-1 text-xs text-slate-500">
                                Created: {formatDateTime(lineItem.DateCreated)}
                              </span>

                              {lineItem.EncodedByUser && (
                                <span className="text-xs text-slate-500">
                                  Encoded by: {lineItem.EncodedByUser.LastName},{" "}
                                  {lineItem.EncodedByUser.FirstName}{" "}
                                  {lineItem.EncodedByUser.MiddleName ?? ""}
                                </span>
                              )}

                              <span className="mt-1 text-xs text-slate-500">
                                Active:{" "}
                                <span
                                  className={
                                    lineItem.IsActive ? "" : "text-red-600"
                                  }
                                >
                                  {lineItem.IsActive ? "Yes" : "No"}
                                </span>
                              </span>
                            </div>
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 align-top">
                            {note ? (
                              <div className="flex flex-col">
                                <span className="text-slate-900">
                                  {note.NotesDescription}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  Note ID: {note.ID}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  Created: {formatDateTime(note.DateCreated)}
                                </span>
                                {note.EncodedByUser && (
                                  <span className="text-xs text-slate-500">
                                    Encoded by: {note.EncodedByUser.LastName},{" "}
                                    {note.EncodedByUser.FirstName}{" "}
                                    {note.EncodedByUser.MiddleName ?? ""}
                                  </span>
                                )}
                                <span className="mt-1 text-xs text-slate-500">
                                  Active:{" "}
                                  <span
                                    className={
                                      note.IsActive ? "" : "text-red-600"
                                    }
                                  >
                                    {note.IsActive ? "Yes" : "No"}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                No notes line items
                              </span>
                            )}
                          </td>

                          <td className="border-b border-slate-200 px-4 py-3 align-top text-right">
                            {note ? (
                              <button
                                type="button"
                                onClick={() => openModify(note)}
                                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                                data-id={note.ID}
                              >
                                Modify
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ));
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Modal (same concept as other views) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          selected
            ? `Modify Notes Line Item (ID: ${selected.ID})`
            : "Modify Notes Line Item"
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
              form="notesLineItemForm"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={!isValid || isSubmitting || !selected}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form id="notesLineItemForm" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Notes Line Item
            </label>

            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Enter notes line item description"
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
                {selected.FsAccountObj?.AccountGroupObj?.AccountTypeObj?.Type ??
                  "—"}
              </div>

              <div className="mt-1">
                <span className="font-medium text-slate-700">Group:</span>{" "}
                {selected.FsAccountObj?.AccountGroupObj?.Category ?? "—"}
              </div>

              <div className="mt-1">
                <span className="font-medium text-slate-700">FS Line:</span>{" "}
                {selected.FsAccountObj?.FsAccountName ?? "—"}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
