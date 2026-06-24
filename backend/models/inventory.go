package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CreateInventoryRequest struct {
	ProductName     string    `json:"product_name"`
	UnitMeasurement string    `json:"unit_measurement"`
	CostPerUnit     float64   `json:"cost_per_unit"`
	AccountNumber   string    `json:"account_number"`
	EncodedBy       uuid.UUID `json:"encoded_by"`
}

type UpdateInventoryRequest struct {
	ProductName     *string    `json:"product_name"`
	UnitMeasurement *string    `json:"unit_measurement"`
	CostPerUnit     *float64   `json:"cost_per_unit"`
	AccountNumber   *string    `json:"account_number"`
	EncodedBy       *uuid.UUID `json:"encoded_by"`
}

type Inventory struct {
	ProductCode     uuid.UUID `gorm:"type:uuid;primaryKey" json:"product_code"`
	CompanyID       uuid.UUID `gorm:"type:uuid" json:"company_id"`
	ProductName     string    `gorm:"type:varchar(255);not null" json:"product_name"`
	UnitMeasurement string    `gorm:"type:varchar(50)" json:"unit_measurement"`
	CostPerUnit     float64   `gorm:"type:numeric(12,2)" json:"cost_per_unit"`
	AccountNumber   string    `gorm:"type:varchar(50)" json:"account_number"`
	EncodedBy       uuid.UUID `gorm:"type:uuid" json:"encoded_by"`
	Coa             *Coa      `gorm:"foreignKey:AccountNumber;references:ID" json:"coa,omitempty"`

	CreatedAt time.Time `gorm:"type:timestamptz" json:"created_at"`
	UpdatedAt time.Time `gorm:"type:timestamptz" json:"updated_at"`
}

func (Inventory) TableName() string { return "inventory" }

func (i *Inventory) BeforeCreate(tx *gorm.DB) (err error) {
	i.ProductCode = uuid.New()
	i.CreatedAt = time.Now()
	i.UpdatedAt = time.Now()
	return
}
