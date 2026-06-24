package models

import (
	"time"

	"github.com/google/uuid"
)



type CreateCoaAccountNotesLineItem struct {
	
	AccountType int    
	AccountGroup int 
	FsAccount int
	ID   string 
	NotesDescription string
}



type CoaNotesLineItem struct {
	ID               int
	AccountType      int
	AccountGroup     int
	FsAccount        int
	NotesDescription string
	CompanyID        uuid.UUID
	EncodedBy         uuid.UUID
	DateCreated      time.Time
	DateUpdated      time.Time
	IsActive         bool

EncodedByUser *Users         `json:"EncodedByUser,omitempty" gorm:"foreignKey:EncodedBy;references:UserID"`
FsAccountObj  *CoaFsLineItem `json:"FsAccountObj,omitempty" gorm:"foreignKey:FsAccount;references:ID"`

}


func (CoaNotesLineItem) TableName() string {
	return "coa_notes_line_item"
}
