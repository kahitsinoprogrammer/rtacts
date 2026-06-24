package models

import (
	"time"

	"github.com/google/uuid"
)

type CreateCoaRequest struct {
	AccountType int
	AccountGroup int
	FsLine int
	NotesLine int

	ID string
	AccountDescription string
	AccountLongDesc string // optional from textarea
}

type Coa struct {
	ID int

	AccountType  int
	AccountGroup int
	FsLine       int
	NotesLine    int

	AccountDescription string
	AccountLongDesc    string

	CompanyID    uuid.UUID
	EncodedBy    uuid.UUID
	DateCreated  time.Time
	DateUpdated  time.Time
	IsActive     bool

	EncodedByUser   *Users           `gorm:"foreignKey:EncodedBy;references:UserID"`
	AccountTypeObj  *CoaAccountType  `gorm:"foreignKey:AccountType;references:ID"`
	AccountGroupObj *CoaAccountGroup `gorm:"foreignKey:AccountGroup;references:ID"`
	FsLineObj       *CoaFsLineItem   `gorm:"foreignKey:FsLine;references:ID"`
	NotesLineObj    *CoaNotesLineItem `gorm:"foreignKey:NotesLine;references:ID"`
}


func (Coa) TableName() string {
	return "coa"
}
