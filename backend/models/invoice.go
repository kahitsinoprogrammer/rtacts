package models

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateInvoiceRequest struct {
	Customer string                     `json:"customer"`
	Items    []CreateInvoiceItemRequest `json:"items"`
}

type PreviewInvoiceRequest struct {
	Items []CreateInvoiceItemRequest `json:"items"`
}

type InvoiceTaxType string

const (
	InvoiceTaxTypeVatable InvoiceTaxType = "vatable"
	InvoiceTaxTypeExempt  InvoiceTaxType = "exempt"
	InvoiceTaxTypeTaxable InvoiceTaxType = "taxable"
)

type CreateInvoiceItemRequest struct {
	ProductID uuid.UUID      `json:"product_id"`
	LineNo    int            `json:"line_no"`
	Quantity  float64        `json:"quantity"`
	TaxType   InvoiceTaxType `json:"tax_type"`
}

type PreviewInvoiceItem struct {
	ProductID   uuid.UUID      `json:"product_id"`
	LineNo      int            `json:"line_no"`
	Quantity    float64        `json:"quantity"`
	UnitPrice   float64        `json:"unit_price"`
	Amount      float64        `json:"amount"`
	TotalAmount float64        `json:"total_amount"`
	TaxType     InvoiceTaxType `json:"tax_type"`
}

type PreviewInvoiceResponse struct {
	Items       []PreviewInvoiceItem `json:"items"`
	TotalAmount float64              `json:"total_amount"`
}

func (t InvoiceTaxType) Normalize() (InvoiceTaxType, error) {
	normalized := InvoiceTaxType(strings.ToLower(strings.TrimSpace(string(t))))
	if normalized == "" {
		return InvoiceTaxTypeVatable, nil
	}

	switch normalized {
	case InvoiceTaxTypeVatable, InvoiceTaxTypeExempt, InvoiceTaxTypeTaxable:
		return normalized, nil
	default:
		return "", errors.New("tax_type must be one of: vatable, exempt, taxable")
	}
}

type Invoice struct {
	ID           string     `gorm:"primaryKey;size:50" json:"id"`
	Customer     string     `gorm:"type:varchar(255);not null" json:"customer"`
	TotalAmount  float64    `gorm:"-" json:"total_amount"`
	CreatedAt    time.Time  `gorm:"type:timestamptz" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"type:timestamptz" json:"updated_at"`
	ApprovedBy   *uuid.UUID `gorm:"type:uuid" json:"approved_by"`
	ApprovedDate *time.Time `gorm:"type:timestamptz" json:"approved_date"`
	Status       string     `gorm:"type:text" json:"status"`
	PreparedBy   *uuid.UUID `gorm:"type:uuid" json:"prepared_by"`

	PreparedByUser *Users        `json:"PreparedByUser,omitempty" gorm:"foreignKey:PreparedBy;references:UserID"`
	ApprovedByUser *Users        `json:"ApprovedByUser,omitempty" gorm:"foreignKey:ApprovedBy;references:UserID"`
	Items          []InvoiceItem `gorm:"foreignKey:InvoiceID;references:ID" json:"items"`
}

type InvoiceItem struct {
	ID          string         `gorm:"primaryKey;size:50" json:"id"`
	InvoiceID   string         `gorm:"size:50" json:"invoice_id"`
	ProductID   uuid.UUID      `gorm:"type:uuid" json:"product_id"`
	LineNo      int            `json:"line_no"`
	Quantity    float64        `json:"quantity"`
	Amount      float64        `json:"amount"`
	TotalAmount float64        `json:"total_amount"`
	TaxType     InvoiceTaxType `gorm:"column:vatable;type:varchar(20)" json:"tax_type"`
	UnitPrice   float64        `gorm:"type:numeric(15,2)" json:"unit_price"`

	Product *Inventory `json:"product,omitempty" gorm:"foreignKey:ProductID;references:ProductCode"`
}

func (Invoice) TableName() string     { return "invoice" }
func (InvoiceItem) TableName() string { return "invoice_items" }

func (i *Invoice) BeforeCreate(tx *gorm.DB) (err error) {
	now := time.Now().UTC()
	if i.ID == "" {
		var last Invoice
		if err := tx.Select("id").Order("id DESC").Take(&last).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		i.ID = nextInvoiceCode(last.ID)
	}
	i.CreatedAt = now
	i.UpdatedAt = now
	return nil
}

func (i *InvoiceItem) BeforeCreate(tx *gorm.DB) (err error) {
	if i.ID == "" {
		i.ID = nextInvoiceItemCode(i.InvoiceID, i.LineNo)
	}
	return nil
}

func nextInvoiceCode(lastID string) string {
	const prefix = "INV-"
	const defaultValue = 1

	if lastID == "" || !strings.HasPrefix(lastID, prefix) {
		return fmt.Sprintf("%s%04d", prefix, defaultValue)
	}

	numericPart := strings.TrimPrefix(lastID, prefix)
	n, err := strconv.Atoi(numericPart)
	if err != nil {
		return fmt.Sprintf("%s%04d", prefix, defaultValue)
	}

	return fmt.Sprintf("%s%04d", prefix, n+1)
}

func nextInvoiceItemCode(invoiceID string, lineNo int) string {
	if invoiceID == "" {
		return "INV-0000-0000"
	}
	if lineNo < 1 {
		lineNo = 1
	}
	return fmt.Sprintf("%s-%04d", invoiceID, lineNo)
}
