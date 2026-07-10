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

type CreateJournalVoucherRequest struct {
	SupplierID uuid.UUID            `json:"supplier_id"`
	CompanyID  uuid.UUID            `json:"company_id"`
	PreparedBy *uuid.UUID           `json:"prepared_by"`
	Status     *string              `json:"status"`
	Remarks    *string              `json:"remarks"`
	Items      []JournalVoucherItem `json:"items"`
}

type UpdateJournalVoucherStatusRequest struct {
	Status        string  `json:"status"`
	RejectRemarks *string `json:"reject_remarks"`
}

type JournalVoucher struct {
	ID            string `gorm:"primaryKey;size:20" json:"id"`
	SupplierID    uuid.UUID
	CompanyID     uuid.UUID
	PreparedBy    *uuid.UUID
	ApprovedBy    *uuid.UUID
	Status        string
	ApprovedDate  *time.Time
	Remarks       *string `gorm:"type:text" json:"remarks,omitempty"`
	RejectRemarks *string `json:"reject_remarks,omitempty"`

	CreatedAt time.Time
	UpdatedAt time.Time

	Supplier       *Supplier            `json:"supplier,omitempty" gorm:"foreignKey:SupplierID;references:SupplierID"`
	PreparedByUser *Users               `json:"PreparedByUser,omitempty" gorm:"foreignKey:PreparedBy;references:UserID"`
	ApprovedByUser *Users               `json:"ApprovedByUser,omitempty" gorm:"foreignKey:ApprovedBy;references:UserID"`
	Items          []JournalVoucherItem `gorm:"foreignKey:JournalVoucherID;references:ID"`
}

type JournalVoucherItem struct {
	ID               string     `gorm:"primaryKey;size:20" json:"id"`
	JournalVoucherID string     `gorm:"column:check_voucher_id" json:"journal_voucher_id"`
	AccountID        *int       `json:"account_id"`
	Account          *Coa       `json:"account,omitempty" gorm:"foreignKey:AccountID;references:ID"`
	Debit            float64    `json:"debit"`
	Credit           float64    `json:"credit"`
	VatTypeID        *uuid.UUID `json:"vat_type_id"`
	LineNo           int        `json:"line_no"`
}

func (JournalVoucher) TableName() string     { return "journal_vouchers" }
func (JournalVoucherItem) TableName() string { return "journal_voucher_items" }

func (j *JournalVoucher) BeforeCreate(tx *gorm.DB) (err error) {
	now := time.Now()
	if j.ID == "" {
		var last JournalVoucher
		if err := tx.Select("id").Order("id DESC").Take(&last).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		j.ID = nextJVCode(last.ID)
	}
	j.CreatedAt = now
	j.UpdatedAt = now
	return
}

func (i *JournalVoucherItem) BeforeCreate(tx *gorm.DB) (err error) {
	if i.ID == "" {
		i.ID = nextJVItemCode(i.JournalVoucherID, i.LineNo)
	}
	return
}

func nextJVCode(lastID string) string {
	const prefix = "JV-"
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

func nextJVItemCode(journalVoucherID string, lineNo int) string {
	if journalVoucherID == "" {
		return "JV-0000-0000"
	}
	if lineNo < 1 {
		lineNo = 1
	}
	return fmt.Sprintf("%s-%04d", journalVoucherID, lineNo)
}
