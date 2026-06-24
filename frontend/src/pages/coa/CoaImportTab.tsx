import React from "react";

type ImportResult = {
  success?: boolean;
  message?: string;
  // optional: backend can return row errors like:
  // errors?: Array<{ row: number; field?: string; message: string }>;
  errors?: Array<{ row: number; field?: string; message: string }>;
};

export default function CoaImportTab() {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  const onPickFile = (f: File | null) => {
    setResult(null);

    if (!f) {
      setFile(null);
      return;
    }

    const name = f.name.toLowerCase();
    const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");

    if (!isExcel) {
      alert(
        "Please upload an Excel file (.xlsx or .xls) following the template."
      );
      setFile(null);
      return;
    }

    setFile(f);
  };

  const downloadTemplate = async () => {
    try {
      // Backend should return the template file:
      // GET /chart-of-accounts/coa-template
      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/coa-template",
        {
          method: "GET",
          credentials: "include",
        }
      );

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        alert(msg);
        return;
      }

      // Download file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;

      // you can name it anything; backend can also set Content-Disposition
      a.download = "COA_TEMPLATE.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to download template");
    }
  };

  const uploadSheet = async () => {
    if (!file) {
      alert("Please choose an Excel file first.");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      // Backend endpoint:
      // POST /chart-of-accounts/import-coa
      const res = await fetch(
        "http://localhost:8080/chart-of-accounts/import-coa",
        {
          method: "POST",
          credentials: "include",
          body: form,
        }
      );

      if (!res.ok) {
        let msg = `Upload failed (HTTP ${res.status})`;
        let body: any = null;

        try {
          body = await res.json();
          if (body?.error) msg = body.error;
        } catch {}

        // If backend returns row validation errors:
        setResult({
          success: false,
          message: msg,
          errors: body?.errors ?? undefined,
        });

        alert(msg);
        return;
      }

      const data = (await res.json()) as ImportResult;

      setResult({
        success: true,
        message: data?.message ?? "Import completed successfully.",
        errors: data?.errors ?? undefined,
      });

      alert(data?.message ?? "Import completed successfully.");
      setFile(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setResult({ success: false, message: msg });
      alert(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">
          Import Chart of Accounts
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Download the template, fill it out, then upload the Excel file. The
          system will create unique Account Types, Groups, FS Lines, Notes
          Lines, and COA items.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Download Template
          </button>

          <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            Choose Excel File
          </label>

          <button
            type="button"
            onClick={uploadSheet}
            disabled={!file || uploading}
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload & Import"}
          </button>
        </div>

        <div className="mt-3 text-sm text-slate-700">
          <div>
            <span className="font-medium">Selected file:</span>{" "}
            {file ? file.name : <span className="text-slate-400">None</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Only upload files that follow the template columns and format.
          </p>
        </div>
      </div>

      {/* Result / Errors */}
      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {result.success ? "Import Result" : "Import Failed"}
              </h3>
              {result.message && (
                <p className="mt-1 text-sm text-slate-700">{result.message}</p>
              )}
            </div>
            <span
              className={[
                "rounded-full px-2 py-1 text-xs font-medium",
                result.success
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              {result.success ? "SUCCESS" : "ERROR"}
            </span>
          </div>

          {result.errors?.length ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-slate-900">Row Errors</p>
              <div className="mt-2 max-h-64 overflow-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-medium text-slate-700">
                        Row
                      </th>
                      <th className="px-3 py-2 font-medium text-slate-700">
                        Field
                      </th>
                      <th className="px-3 py-2 font-medium text-slate-700">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, idx) => (
                      <tr key={idx} className="border-t border-slate-200">
                        <td className="px-3 py-2">{e.row}</td>
                        <td className="px-3 py-2">{e.field ?? "-"}</td>
                        <td className="px-3 py-2">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Fix the rows above, re-save the file, then upload again.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
