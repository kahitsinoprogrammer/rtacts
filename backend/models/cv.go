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

type CreateCheckVoucherRequest struct {
	SupplierID uuid.UUID          `json:"supplier_id"`
	CompanyID  uuid.UUID          `json:"company_id"`
	PreparedBy *uuid.UUID         `json:"prepared_by"`
	Status     *string            `json:"status"`
	Remarks    *string            `json:"remarks"`
	Items      []CheckVoucherItem `json:"items"`
}

type UpdateCheckVoucherStatusRequest struct {
	Status        string  `json:"status"`
	RejectRemarks *string `json:"reject_remarks"`
}

type CheckVoucher struct {
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

	Supplier       *Supplier          `json:"supplier,omitempty" gorm:"foreignKey:SupplierID;references:SupplierID"`
	PreparedByUser *Users             `json:"PreparedByUser,omitempty" gorm:"foreignKey:PreparedBy;references:UserID"`
	ApprovedByUser *Users             `json:"ApprovedByUser,omitempty" gorm:"foreignKey:ApprovedBy;references:UserID"`
	Items          []CheckVoucherItem `gorm:"foreignKey:CheckVoucherID;references:ID"`
}

type CheckVoucherItem struct {
	ID             string     `gorm:"primaryKey;size:20" json:"id"`
	CheckVoucherID string     `json:"check_voucher_id"`
	AccountID      *int       `json:"account_id"`
	Account        *Coa       `json:"account,omitempty" gorm:"foreignKey:AccountID;references:ID"`
	Debit          float64    `json:"debit"`
	Credit         float64    `json:"credit"`
	VatTypeID      *uuid.UUID `json:"vat_type_id"`
	LineNo         int        `json:"line_no"`
}

func (CheckVoucher) TableName() string     { return "check_vouchers" }
func (CheckVoucherItem) TableName() string { return "check_voucher_items" }

func (c *CheckVoucher) BeforeCreate(tx *gorm.DB) (err error) {
	now := time.Now()
	if c.ID == "" {
		var last CheckVoucher
		if err := tx.Select("id").Order("id DESC").Take(&last).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		c.ID = nextCVCode(last.ID)
	}
	c.CreatedAt = now
	c.UpdatedAt = now
	return
}

func (i *CheckVoucherItem) BeforeCreate(tx *gorm.DB) (err error) {
	if i.ID == "" {
		i.ID = nextCVItemCode(i.CheckVoucherID, i.LineNo)
	}
	return
}

func nextCVCode(lastID string) string {
	const prefix = "CV-"
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

func nextCVItemCode(checkVoucherID string, lineNo int) string {
	if checkVoucherID == "" {
		return "CV-0000-0000"
	}
	if lineNo < 1 {
		lineNo = 1
	}
	return fmt.Sprintf("%s-%04d", checkVoucherID, lineNo)
}
