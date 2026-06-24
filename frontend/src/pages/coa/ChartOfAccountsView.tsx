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

  // ✅ group -> type (preloaded)
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

  // ✅ fs -> group (preloaded)
  AccountGroupObj?: AccountGroupObj;
};

type NotesLineItemObj = {
  ID: number;
  AccountType: number;
  AccountGroup: number;
  FsAccount: number;
  NotesDescription: string;
  CompanyID: string;
  EncodedBy: string;
  DateCreated: string;
  DateUpdated?: string;
  EncodedByUser?: EncodedByUserType;
  IsActive: boolean;

  // ✅ notes -> fs (preloaded)
  FsAccountObj?: FsLineItemObj;
};

// ✅ COA row (service returns this)
type CoaItem = {
  ID: number;

  AccountType: number;
  AccountGroup: number;
  FsLine: number;
  NotesLine: number;

  AccountDescription: string;
  AccountLongDesc: string;

  CompanyID: string;
  EncodedBy: string;
  DateCreated: string;
  DateUpdated: string;

  IsActive: boolean;

  // ✅ coa -> encodedBy (preloaded)
  EncodedByUser?: EncodedByUserType;

  // ✅ coa -> notes -> fs -> group -> type (preloaded chain)
  NotesLineObj?: NotesLineItemObj;
};

type CoaFormValues = {
  accountDescription: string;
  accountLongDesc: string;
  isInactive: boolean;
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "";
  const [d, t] = iso.split("T");
  if (!t) return d;
  return `${d} ${t.split(".")[0]}`;
};



export default function CoaView() {


  const [coaItems, setCoaItems] = useState<CoaItem[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ modal state (same concept as NotesLineItemsView)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCoa, setSelectedCoa] = useState<CoaItem | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<CoaFormValues>({
    mode: "onChange",
    defaultValues: {
      accountDescription: "",
      accountLongDesc: "",
      isInactive: false,
    },
  });

   
  const load = async () => {
    setLoading(true);
    try {
      // ✅ ONE API CALL ONLY (matches your new service)
      const coaRes = await fetch(
        "http://localhost:8080/chart-of-accounts/coa-items",
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!coaRes.ok) {
        alert(`COA Items Error: ${coaRes.status}`);
        return;
      }

      const coaData = (await coaRes.json()) as CoaItem[];
      setCoaItems(Array.isArray(coaData) ? coaData : []);
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
   * Build view model from *service result only*:
   * COA -> NotesLineObj -> FsAccountObj -> AccountGroupObj -> AccountTypeObj
   */
  const viewModel = useMemo(() => {
    const byType = new Map<
      number,
      {
        type: AccountTypeObj;
        groups: Map<
          number,
          {
            group: AccountGroupObj;
            fsLines: Map<
              number,
              {
                fsLine: FsLineItemObj;
                notes: Map<
                  number,
                  { note: NotesLineItemObj; coaRows: CoaItem[] }
                >;
              }
            >;
          }
        >;
      }
    >();

    for (const coa of coaItems) {
      const note = coa.NotesLineObj;
      const fs = note?.FsAccountObj;
      const group = fs?.AccountGroupObj;
      const type = group?.AccountTypeObj;

      // strict: if chain is missing, skip
      if (!note || !fs || !group || !type) continue;

      // Type bucket
      if (!byType.has(type.ID)) {
        byType.set(type.ID, { type, groups: new Map() });
      }
      const t = byType.get(type.ID)!;

      // Group bucket
      if (!t.groups.has(group.ID)) {
        t.groups.set(group.ID, { group, fsLines: new Map() });
      }
      const g = t.groups.get(group.ID)!;

      // FS bucket
      if (!g.fsLines.has(fs.ID)) {
        g.fsLines.set(fs.ID, { fsLine: fs, notes: new Map() });
      }
      const f = g.fsLines.get(fs.ID)!;

      // Notes bucket
      if (!f.notes.has(note.ID)) {
        f.notes.set(note.ID, { note, coaRows: [] });
      }
      f.notes.get(note.ID)!.coaRows.push(coa);
    }

    // Convert to sorted arrays
    return Array.from(byType.values())
      .sort((a, b) => a.type.ID - b.type.ID)
      .map((t) => ({
        type: t.type,
        groups: Array.from(t.groups.values())
          .sort((a, b) => a.group.ID - b.group.ID)
          .map((g) => ({
            group: g.group,
            fsLines: Array.from(g.fsLines.values())
              .sort((a, b) => a.fsLine.ID - b.fsLine.ID)
              .map((f) => ({
                fsLine: f.fsLine,
                notes: Array.from(f.notes.values())
                  .sort((a, b) => a.note.ID - b.note.ID)
                  .map((n) => ({
                    note: n.note,
                    coaRows: n.coaRows.sort((a, b) => a.ID - b.ID),
                  })),
              })),
          })),
      }));
  }, [coaItems]);

  // ✅ open modal and preload form values (no submit yet)
  const openModify = (coaRow: CoaItem) => {
    setSelectedCoa(coaRow);

    reset({
      accountDescription: coaRow.AccountDescription ?? "",
      accountLongDesc: coaRow.AccountLongDesc ?? "",
      isInactive: !coaRow.IsActive,
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCoa(null);
    reset({
      accountDescription: "",
      accountLongDesc: "",
      isInactive: false,
    });
  };

  const onSubmit = handleSubmit(async (data) => {
    if (!selectedCoa) return;

    const payload = {
      id: selectedCoa.ID,
      accountDescription: data.accountDescription.trim(), // ✅ controller JSON key
      accountLongDesc: (data.accountLongDesc ?? "").trim(), // ✅ controller JSON key
      isActive: !data.isInactive, // ✅ checkbox logic preserved
    };

    try {
      const res = await fetch(
        `http://localhost:8080/chart-of-accounts/coa-items/${payload.id}/deactivate`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountDescription: payload.accountDescription,
            accountLongDesc: payload.accountLongDesc,
            isActive: payload.isActive,
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

      await load(); // ✅ reload list
      closeModal();
    } catch (e) {
      alert("Failed to save COA item");
    }
  });


  return (
    <>
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-800">
          Chart of Accounts
        </h2>

        <div className="rounded-md border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Loading...</div>
          ) : coaItems.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              No COA items found.
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
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Account Description
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Long Description
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {viewModel.flatMap(({ type, groups }) =>
                    groups.flatMap(({ group, fsLines }) => {
                      // Expand: FS -> Notes -> COA (repeat parent data per row)
                      const expanded = fsLines.flatMap((fsBundle) => {
                        const notesBundles =
                          fsBundle.notes.length > 0
                            ? fsBundle.notes
                            : [{ note: null as any, coaRows: [null as any] }];

                        return notesBundles.flatMap((nb, noteIdx) => {
                          const rows = nb.coaRows?.length ? nb.coaRows : [null];

                          return rows.map((coaRow, coaIdx) => ({
                            fsLine: fsBundle.fsLine,
                            note: nb.note ?? null,
                            coaRow: coaRow ?? null,
                            key: `${type.ID}-${group.ID}-${
                              fsBundle.fsLine.ID
                            }-${nb.note ? nb.note.ID : "no-note"}-${
                              coaRow ? coaRow.ID : "no-coa"
                            }-${noteIdx}-${coaIdx}`,
                          }));
                        });
                      });

                      return expanded.map(({ fsLine, note, coaRow, key }) => (
                        <tr key={key} className="hover:bg-slate-50">
                          {/* Account Type */}
                          <td className="border-b border-slate-200 px-4 py-3 align-top font-medium text-slate-900">
                            {type.Type}
                            <div className="mt-1 text-xs text-slate-500">
                              Type ID: {type.ID}
                            </div>
                          </td>

                          {/* Account Group */}
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

                          {/* FS Line */}
                          <td className="border-b border-slate-200 px-4 py-3 align-top">
                            <div className="flex flex-col">
                              <span className="text-slate-900">
                                {fsLine.FsAccountName}
                              </span>
                              <span className="mt-1 text-xs text-slate-500">
                                Item ID: {fsLine.ID}
                              </span>
                              <span className="mt-1 text-xs text-slate-500">
                                Created: {formatDateTime(fsLine.DateCreated)}
                              </span>

                              {fsLine.EncodedByUser && (
                                <span className="text-xs text-slate-500">
                                  Encoded by: {fsLine.EncodedByUser.LastName},{" "}
                                  {fsLine.EncodedByUser.FirstName}{" "}
                                  {fsLine.EncodedByUser.MiddleName ?? ""}
                                </span>
                              )}

                              <span className="mt-1 text-xs text-slate-500">
                                Active:{" "}
                                <span
                                  className={
                                    fsLine.IsActive ? "" : "text-red-600"
                                  }
                                >
                                  {fsLine.IsActive ? "Yes" : "No"}
                                </span>
                              </span>
                            </div>
                          </td>

                          {/* Notes Line */}
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

                          {/* COA Desc */}
                          <td className="border-b border-slate-200 px-4 py-3 align-top">
                            {coaRow ? (
                              <div className="flex flex-col">
                                <span className="text-slate-900">
                                  {coaRow.AccountDescription}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  COA ID: {coaRow.ID}
                                </span>
                                <span className="mt-1 text-xs text-slate-500">
                                  Created: {formatDateTime(coaRow.DateCreated)}
                                </span>
                                {coaRow.EncodedByUser && (
                                  <span className="text-xs text-slate-500">
                                    Encoded by: {coaRow.EncodedByUser.LastName},{" "}
                                    {coaRow.EncodedByUser.FirstName}{" "}
                                    {coaRow.EncodedByUser.MiddleName ?? ""}
                                  </span>
                                )}
                                <span className="mt-1 text-xs text-slate-500">
                                  Active:{" "}
                                  <span
                                    className={
                                      coaRow.IsActive ? "" : "text-red-600"
                                    }
                                  >
                                    {coaRow.IsActive ? "Yes" : "No"}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* COA Long Desc */}
                          <td className="border-b border-slate-200 px-4 py-3 align-top">
                            {coaRow ? (
                              <span className="text-slate-700">
                                {coaRow.AccountLongDesc || "—"}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Action */}
                          <td className="border-b border-slate-200 px-4 py-3 align-top text-right">
                            {coaRow ? (
                              <button
                                type="button"
                                onClick={() => openModify(coaRow)}
                                className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                                data-id={coaRow.ID}
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

      {/* ✅ Modal (submit will be added later) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          selectedCoa
            ? `Modify COA Item (ID: ${selectedCoa.ID})`
            : "Modify COA Item"
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

            {/* disabled for now since submit comes later */}
            <button
              type="submit"
              form="coaForm"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={isSubmitting || !selectedCoa}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form id="coaForm" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Account Description
            </label>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Enter account description"
              {...register("accountDescription", {
                required: "Account description is required",
                setValueAs: (v) => (typeof v === "string" ? v : ""),
              })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Long Description
            </label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Enter long description"
              {...register("accountLongDesc", {
                setValueAs: (v) => (typeof v === "string" ? v : ""),
              })}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="coaInactive"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              {...register("isInactive")}
            />
            <label htmlFor="coaInactive" className="text-sm text-slate-700">
              Mark as inactive
            </label>
          </div>

          {/* optional: show selected context (read-only) */}
          {selectedCoa && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div>
                <span className="font-medium text-slate-700">Type:</span>{" "}
                {selectedCoa.NotesLineObj?.FsAccountObj?.AccountGroupObj
                  ?.AccountTypeObj?.Type ?? "—"}
              </div>
              <div className="mt-1">
                <span className="font-medium text-slate-700">Group:</span>{" "}
                {selectedCoa.NotesLineObj?.FsAccountObj?.AccountGroupObj
                  ?.Category ?? "—"}
              </div>
              <div className="mt-1">
                <span className="font-medium text-slate-700">FS Line:</span>{" "}
                {selectedCoa.NotesLineObj?.FsAccountObj?.FsAccountName ?? "—"}
              </div>
              <div className="mt-1">
                <span className="font-medium text-slate-700">Notes Line:</span>{" "}
                {selectedCoa.NotesLineObj?.NotesDescription ?? "—"}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
