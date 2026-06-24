import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "../../components/Modal";

type EncodedByUserType = {
  FirstName: string;
  LastName: string;
  MiddleName: string;
  UserID: string;
};

type AccountType = {
  ID: number;
  Type: string;
  DateCreated: string;
  IsActive: boolean;
};

type AccountGroup = {
  ID: number;
  AccountType: number; // FK id
  Category: string;
  CompanyID: string;
  DateCreated: string;
  DateUpdated: string;
  EncodedBy: string;
  EncodedByUser?: EncodedByUserType | null;
  IsActive: boolean;

  AccountTypeObj?: AccountType | null;
};

type FormValues = {
  name: string; // group/category name
  isInactive: boolean; // checkbox: "Mark as inactive"
};

const formatDateTime = (iso?: string) => {
  if (!iso) return "";
  const [d, t] = iso.split("T");
  if (!t) return d;
  return `${d} ${t.split(".")[0]}`;
};

export default function AccountGroupTabView() {
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ modal state (same concept as AccountTypeView)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<AccountGroup | null>(null);

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

  const loadAccountGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/account-categories",
        { method: "GET", credentials: "include" }
      );

      if (!res.ok) {
        alert(`Account Groups Error: ${res.status}`);
        return;
      }

      const data = (await res.json()) as AccountGroup[];
      setGroups(Array.isArray(data) ? data : []);

      console.log("groupsxxx:", data);
    } catch (e) {
      alert("Error: failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountGroups();
  }, []);

  // ✅ group groups by embedded AccountTypeObj.ID
  const rowsByType = useMemo(() => {
    const map = new Map<
      number,
      { type: AccountType; groups: AccountGroup[] }
    >();

    for (const g of groups) {
      const t = g.AccountTypeObj;
      if (!t) continue;

      if (!map.has(t.ID)) {
        map.set(t.ID, { type: t, groups: [] });
      }
      map.get(t.ID)!.groups.push(g);
    }

    for (const entry of map.values()) {
      entry.groups.sort((a, b) => a.ID - b.ID);
    }

    return Array.from(map.values()).sort((a, b) => a.type.ID - b.type.ID);
  }, [groups]);

  // ✅ open modal and preload form values
  const openModify = (g: AccountGroup) => {
    setSelected(g);

    reset({
      name: g.Category ?? "",
      isInactive: !g.IsActive, // same meaning: checked => inactive => IsActive false
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelected(null);
    reset({ name: "", isInactive: false });
  };

  // ✅ Account Group submit handler (same format as AccountTypeView)
  const onSubmit = handleSubmit(async (data) => {
    if (!selected) return;

    const payload = {
      id: selected.ID,
      group: data.name.trim(), // ✅ aligns with controller payload key: "group"
      isActive: !data.isInactive, // ✅ checkbox logic preserved
    };

    try {
      const res = await fetch(
        `http://localhost:8080/chart-of-accounts/account-groups/${payload.id}/deactivate`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            group: payload.group, // ✅ { group, isActive }
            isActive: payload.isActive, // ✅ { group, isActive }
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

      await loadAccountGroups(); // ✅ reload list
      closeModal();
    } catch (e) {
      alert("Failed to save account group");
    }
  });

  return (
    <>
      <div className="max-w-4xl space-y-4">
        <h2 className="text-base font-semibold text-slate-800">
          Account Groups
        </h2>

        <div className="rounded-md border border-slate-200 bg-white">
          {loading ? (
            <div className="p-4 text-sm text-slate-600">Loading...</div>
          ) : groups.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              No account groups found.
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
                      Group (Category)
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rowsByType.flatMap(({ type, groups: grouped }) => {
                    const rows = grouped.length ? grouped : [null];

                    return rows.map((g) => (
                      <tr
                        key={`${type.ID}-${g ? g.ID : "empty"}`}
                        className="hover:bg-slate-50"
                      >
                        {/* Account Type */}
                        <td className="border-b border-slate-200 px-4 py-3 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <span>{type.Type}</span>
                            <span className="mt-1 text-xs text-slate-500">
                              Type ID: {type.ID}
                            </span>
                            <span className="mt-1 text-xs text-slate-500">
                              Type Active:{" "}
                              <span
                                className={type.IsActive ? "" : "text-red-600"}
                              >
                                {type.IsActive ? "Yes" : "No"}
                              </span>
                            </span>
                          </div>
                        </td>

                        {/* Group + metadata */}
                        <td className="border-b border-slate-200 px-4 py-3">
                          {g ? (
                            <div className="flex flex-col">
                              <span className="text-slate-900">
                                {g.Category}
                              </span>

                              <span className="mt-1 text-xs text-slate-500">
                                Group ID: {g.ID}
                              </span>

                              <span className="mt-1 text-xs text-slate-500">
                                Encoded at: {formatDateTime(g.DateCreated)}
                              </span>

                              {g.EncodedByUser && (
                                <span className="text-xs text-slate-500">
                                  Encoded by: {g.EncodedByUser.LastName},{" "}
                                  {g.EncodedByUser.FirstName}{" "}
                                  {g.EncodedByUser.MiddleName ?? ""}
                                </span>
                              )}

                              <span className="mt-1 text-xs text-slate-500">
                                Active:{" "}
                                <span
                                  className={g.IsActive ? "" : "text-red-600"}
                                >
                                  {g.IsActive ? "Yes" : "No"}
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">No groups</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="border-b border-slate-200 px-4 py-3 text-right">
                          {g && (
                            <button
                              type="button"
                              onClick={() => openModify(g)}
                              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                            >
                              Modify
                            </button>
                          )}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Modal (same concept as AccountTypeView) */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          selected
            ? `Modify Account Group (ID: ${selected.ID})`
            : "Modify Account Group"
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
              form="accountGroupForm"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={!isValid || isSubmitting || !selected}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form id="accountGroupForm" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Account Group Name
            </label>

            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Enter account group name"
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
          {selected && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              <div>
                <span className="font-medium text-slate-700">Type:</span>{" "}
                {selected.AccountTypeObj?.Type ?? "—"}
              </div>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
