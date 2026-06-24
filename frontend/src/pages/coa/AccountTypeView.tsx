import { useEffect, useState } from "react";
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
  EncodedByUser: EncodedByUserType;
  IsActive: boolean;
};

type FormValues = {
  name: string; // Account type name
  isInactive: boolean; // checkbox: "Mark as inactive"
};

export default function AccountTypeView() {
  const [items, setItems] = useState<AccountType[]>([]);
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<AccountType | null>(null);

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

  const loadAccountTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/account-types",
        { method: "GET", credentials: "include" }
      );

      if (!res.ok) {
        alert(`Error: ${res.status}`);
        return;
      }

      const data = (await res.json()) as AccountType[];
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      alert("Error: failed to load account types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccountTypes();
  }, []);

  const openModify = (g: AccountType) => {
    setSelected(g);

    // IMPORTANT:
    // checkbox = "Mark as inactive" => true means IsActive should become false
    reset({
      name: g.Type ?? "",
      isInactive: !g.IsActive, // active => false (unchecked), inactive => true (checked)
    });

    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelected(null);
    // optional: reset back to defaults
    reset({ name: "", isInactive: false });
  };

  // Your submit handler (wire your update API here)
const onSubmit = handleSubmit(async (data) => {
  if (!selected) return;

  const payload = {
    id: selected.ID,
    type: data.name.trim(),
    isActive: !data.isInactive,
  };

  try {
    const res = await fetch(
      `http://localhost:8080/chart-of-accounts/account-types/${payload.id}/deactivate`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: payload.type,
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
      if (okData?.message === "no changes made") successMsg = "No changes made";
    } catch {
      // no body is fine
    }

    alert(successMsg);

    await loadAccountTypes();
    closeModal();
  } catch (e) {
    alert("Failed to save account type");
  }
});




  return (
    <>
      <div className="max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            Account Types
          </h2>
        </div>

        <div className="rounded-md border border-slate-200 bg-white">
          {loading && items.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              No account types found.
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
                      Details
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it) => (
                    <tr key={String(it.ID)} className="hover:bg-slate-50">
                      <td className="border-b border-slate-200 px-4 py-3 align-top">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {it.Type}
                        </p>
                      </td>

                      <td className="border-b border-slate-200 px-4 py-3 align-top">
                        <div className="min-w-0">
                          <p className="mt-0.5 text-xs text-slate-500">
                            ID: {it.ID}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Encoded at:{" "}
                            {it.DateCreated
                              ? `${it.DateCreated.split("T")[0]} ${
                                  it.DateCreated.split("T")[1].split(".")[0]
                                }`
                              : ""}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Encoded by: {it.EncodedByUser?.LastName},{" "}
                            {it.EncodedByUser?.FirstName}{" "}
                            {it.EncodedByUser?.MiddleName}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Active:{" "}
                            <span className={it.IsActive ? "" : "text-red-600"}>
                              {it.IsActive ? "Yes" : "No"}
                            </span>
                          </p>
                        </div>
                      </td>

                      <td className="border-b border-slate-200 px-4 py-3 align-top text-right">
                        <button
                          type="button"
                          onClick={() => openModify(it)}
                          className="inline-flex items-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
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

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          selected
            ? `Modify Account Type (ID: ${selected.ID})`
            : "Modify Account Type"
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
              form="accountTypeForm"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={!isValid || isSubmitting || !selected}
            >
              {isSubmitting ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form id="accountTypeForm" onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Account Type Name
            </label>

            <input
              type="text"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-400"
              placeholder="Enter account type name"
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
        </form>
      </Modal>
    </>
  );
}
