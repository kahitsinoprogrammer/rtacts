package models

import (
	"time"
	"github.com/google/uuid"
)

type CreateCoaAccountTypeRequest struct {
	AccountType string `json:"accountType"`
}

type CoaAccountType struct {
	ID          int
	Type        string
	CompanyID   uuid.UUID
	EncodedBy   uuid.UUID
	DateCreated time.Time
	DateUpdated time.Time
	EncodedByUser *Users `gorm:"foreignKey:EncodedBy;references:UserID"`
	IsActive bool
}

func (CoaAccountType) TableName() string {
	return "coa_account_type"
}