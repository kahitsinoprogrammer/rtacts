package models

import (
	"time"

	"github.com/google/uuid"
)

type CreateCoaAccountGroupRequest struct {
	AccountType int    
	Category      string 
	ID   string 
}


type CoaAccountGroup struct {
	ID          int
	AccountType int
	Category    string
	CompanyID   uuid.UUID
	EncodedBy   uuid.UUID
	DateCreated time.Time
	DateUpdated time.Time
	IsActive    bool

	EncodedByUser  *Users          `json:"EncodedByUser,omitempty" gorm:"foreignKey:EncodedBy;references:UserID"`
	AccountTypeObj *CoaAccountType `json:"AccountTypeObj,omitempty" gorm:"foreignKey:AccountType;references:ID"`
}

func (CoaAccountGroup) TableName() string {
	return "coa_account_group"
}
