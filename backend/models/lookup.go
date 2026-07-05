package models

type LookupOption struct {
	Value      string `json:"value"`
	Label      string `json:"label"`
	SearchText string `json:"search_text"`
}

type SupplierLookupOption struct {
	Value         string `json:"value"`
	Label         string `json:"label"`
	SearchText    string `json:"search_text"`
	ContactPerson string `json:"contact_person"`
}

type ProductLookupOption struct {
	Value           string  `json:"value"`
	Label           string  `json:"label"`
	SearchText      string  `json:"search_text"`
	UnitMeasurement string  `json:"unit_measurement"`
	UnitPrice       float64 `json:"unit_price"`
}

type InventoryLookupsResponse struct {
	AccountOptions []LookupOption `json:"account_options"`
}

type InventoryManageResponse struct {
	Rows           []Inventory    `json:"rows"`
	AccountOptions []LookupOption `json:"account_options"`
}

type CheckVoucherLookupsResponse struct {
	Suppliers []SupplierLookupOption `json:"suppliers"`
	Customers []LookupOption         `json:"customers"`
	Accounts  []LookupOption         `json:"accounts"`
}

type InvoiceLookupsResponse struct {
	Customers []LookupOption        `json:"customers"`
	Products  []ProductLookupOption `json:"products"`
}
