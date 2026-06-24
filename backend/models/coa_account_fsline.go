package models

import (
	"time"

	"github.com/google/uuid"
)



type CreateCoaAccountFsLineItem struct {
	
	AccountType int    
	AccountGroup int 
	ID   string 
	FsAccountName string
}



type CoaFsLineItem struct {
	ID            int
	AccountType   int
	AccountGroup  int
	FsAccountName string
	CompanyID     uuid.UUID
	EncodedBy     uuid.UUID
	DateCreated   time.Time
	DateUpdated   time.Time
	IsActive      bool

	EncodedByUser   *Users           `json:"EncodedByUser,omitempty" gorm:"foreignKey:EncodedBy;references:UserID"`
	AccountGroupObj *CoaAccountGroup `json:"AccountGroupObj,omitempty" gorm:"foreignKey:AccountGroup;references:ID"`
}

func (CoaFsLineItem) TableName() string {
	return "coa_fs_line_item"
}
