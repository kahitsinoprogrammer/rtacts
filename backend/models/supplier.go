package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateSupplierRequest struct {
	SupplierName string `json:"supplier_name"`
	Email        string `json:"email"`

	ContactPerson string `json:"contact_person"`
	Phone         string `json:"phone"`
	Address       string `json:"address"`
	TaxID         string `json:"tax_id"`

	Status string `json:"status"` // default "active"
	Notes  string `json:"notes"`
}

type UpdateSupplierRequest struct {
	SupplierName  *string `json:"supplier_name"`
	Email         *string `json:"email"`
	ContactPerson *string `json:"contact_person"`
	Phone         *string `json:"phone"`
	Address       *string `json:"address"`
	TaxID         *string `json:"tax_id"`
	Notes         *string `json:"notes"`
	IsActive      *bool   `json:"is_active"`
}

type Supplier struct {
	SupplierID uuid.UUID `gorm:"type:uuid;primaryKey" json:"supplier_id"`
	CompanyID  uuid.UUID `gorm:"type:uuid" json:"company_id"`

	SupplierName string `gorm:"type:varchar(100);not null" json:"supplier_name"`
	Email        string `gorm:"type:varchar(255);not null" json:"email"`

	ContactPerson string `gorm:"type:varchar(255)" json:"contact_person"`
	Phone         string `gorm:"type:varchar(50)" json:"phone"`
	Address       string `gorm:"type:text" json:"address"`
	TaxID         string `gorm:"type:varchar(50)" json:"tax_id"`

	Status string `gorm:"type:varchar(50);default:'active'" json:"status"`
	Notes  string `gorm:"type:text" json:"notes"`

	DateRegistered time.Time `gorm:"type:timestamptz" json:"date_registered"`
	DateUpdated    time.Time `gorm:"type:timestamptz" json:"date_updated"`
}

func (Supplier) TableName() string { return "suppliers" }

func (s *Supplier) BeforeCreate(tx *gorm.DB) (err error) {
	s.SupplierID = uuid.New()
	s.DateRegistered = time.Now()
	s.DateUpdated = time.Now()
	return
}
