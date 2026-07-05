export type InvoiceTaxType = "vatable" | "exempt" | "taxable";

export const invoiceTaxTypeOptions: Array<{
  value: InvoiceTaxType;
  label: string;
}> = [
  { value: "vatable", label: "Vatable" },
  { value: "exempt", label: "Exempt" },
  { value: "taxable", label: "Taxable" },
];

export const invoiceTaxTypeLabels: Record<InvoiceTaxType, string> = {
  vatable: "Vatable",
  exempt: "Exempt",
  taxable: "Taxable",
};

export const normalizeInvoiceTaxType = (
  value?: string | boolean | null,
): InvoiceTaxType | null => {
  if (typeof value === "boolean") {
    return value ? "vatable" : "taxable";
  }

  const normalized = value?.trim().toLowerCase();
  if (normalized === "vatable") return "vatable";
  if (normalized === "exempt") return "exempt";
  if (normalized === "taxable") return "taxable";
  return null;
};
