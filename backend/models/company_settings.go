package models

import (
	"time"

	"github.com/google/uuid"
)

type UpdateCompanySettingsRequest struct {
	CompanyName    string `json:"company_name"`
	CompanyEmail   string `json:"company_email"`
	CompanyPhone   string `json:"company_phone"`
	CompanyAddress string `json:"company_address"`
}

type CompanySettings struct {
	CompanyID      uuid.UUID `gorm:"column:company_id;type:uuid;primaryKey" json:"company_id"`
	CompanyName    string    `gorm:"column:company_name;type:varchar(255);not null;default:''" json:"company_name"`
	CompanyEmail   string    `gorm:"column:company_email;type:varchar(255)" json:"company_email"`
	CompanyPhone   string    `gorm:"column:company_phone;type:varchar(50)" json:"company_phone"`
	CompanyAddress string    `gorm:"column:company_address;type:text" json:"company_address"`
	DateCreated    time.Time `gorm:"column:date_created;type:timestamptz" json:"date_created"`
	DateUpdated    time.Time `gorm:"column:date_updated;type:timestamptz" json:"date_updated"`
}

func (CompanySettings) TableName() string {
	return "company_settings"
}
