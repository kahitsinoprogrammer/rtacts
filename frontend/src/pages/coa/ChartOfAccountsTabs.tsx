import React from "react";
import AccountTypeTab from "./AccountTypeTab";
import AccountGroupTab from "./AccountGroupTab";
import FSLineItems from "./FSLineItems";
import NotesItemTab from "./NotesLineItem";
import ChartOfAccountItemTab from "./ChartOfAccounts";
import CoaImportTab from "./CoaImportTab";
type TabKey =
  | "accountType"
  | "accountGroup"
  | "fsLineItem"
  | "notesLineItem"
  | "chartOfAccounts"
  | "coaImport";

const TABS: { key: TabKey; label: string }[] = [
  { key: "chartOfAccounts", label: "New Chart of Accounts" },
  { key: "accountType", label: "Account Type" },
  { key: "accountGroup", label: "Account Group" },
  { key: "fsLineItem", label: "FS Line Item" },
  { key: "notesLineItem", label: "Notes Line Item" },
  { key: "coaImport", label: "Excel import" },
];

export default function ChartOfAccountsTabs() {
  const [active, setActive] = React.useState<TabKey>("chartOfAccounts");

  return (
    <div className="w-full">
      {/* Tab header */}
      <div className="border-b border-slate-200">
        <nav
          className="-mb-px flex flex-wrap gap-2"
          aria-label="Chart of accounts tabs"
        >
          {TABS.map((t) => {
            const isActive = active === t.key;

            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={[
                  "px-4 py-2 text-sm font-medium rounded-t-md transition",
                  "border border-transparent",
                  isActive
                    ? "text-slate-900 bg-white border-slate-200 border-b-white"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="bg-white border border-slate-200 border-t-0 rounded-b-md p-4">
        {active === "chartOfAccounts" && <ChartOfAccountItemTab />}
        {active === "accountType" && <AccountTypeTab />}
        {active === "accountGroup" && <AccountGroupTab />}
        {active === "fsLineItem" && <FSLineItems />}
        {active === "notesLineItem" && <NotesItemTab />}
        {active == "coaImport" && <CoaImportTab />}
      </div>
    </div>
  );
}
