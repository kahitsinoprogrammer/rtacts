package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

/* =====================================
   =============== DTOs ================
   ===================================== */

// DTO for creating an account safely.
// Only contains fields the frontend is ALLOWED to send.
type CreateAccountRequest struct {
	Username    string `json:"username"`
	Password    string `json:"password"`
	Email       string `json:"email"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	MiddleName  string `json:"middle_name"`
	DateOfBirth string `json:"date_of_birth"`
	ContactNo   string `json:"contact_no"`
}

type UpdateAccountRequest struct {
	Username    *string `json:"username"`
	Email       *string `json:"email"`
	FirstName   *string `json:"first_name"`
	LastName    *string `json:"last_name"`
	MiddleName  *string `json:"middle_name"`
	DateOfBirth *string `json:"date_of_birth"`
	ContactNo   *string `json:"contact_no"`
	IsActive    *bool   `json:"is_active"`
}

// DTO for OTP verification
type VerifyOTPRequest struct {
	UserID string `json:"user_id"`
	OTP    string `json:"otp"`
}

/* =====================================
   ============ MODELS =================
   ===================================== */

/* ========== COMPANIES MODEL ========== */

type Companies struct {
	CompanyId      uuid.UUID `gorm:"column:company_id;primaryKey" json:"company_id"`
	CompanyName    string    `gorm:"column:company_name;type:varchar(255)" json:"company_name"`
	CompanyEmail   string    `gorm:"column:company_email;type:varchar(255)" json:"company_email"`
	CompanyPhone   string    `gorm:"column:company_phone;type:varchar(50)" json:"company_phone"`
	Tin            string    `gorm:"column:tin;type:varchar(100)" json:"tin"`
	BlockNo        string    `gorm:"column:block_no;type:varchar(100)" json:"block_no"`
	City           string    `gorm:"column:city;type:varchar(150)" json:"city"`
	Province       string    `gorm:"column:province;type:varchar(150)" json:"province"`
	Country        string    `gorm:"column:country;type:varchar(150)" json:"country"`
	Zip            string    `gorm:"column:zip;type:varchar(20)" json:"zip"`
	CompanyPic     string    `gorm:"column:company_pic;type:text" json:"company_pic"`
	DateRegistered time.Time `gorm:"column:date_registered" json:"date_registered"`
	DateUpdated    time.Time `gorm:"column:date_updated" json:"date_updated"`
}

func (Companies) TableName() string {
	return "companies"
}

func (c *Companies) BeforeCreate(tx *gorm.DB) (err error) {
	c.CompanyId = uuid.New()
	c.DateRegistered = time.Now()
	c.DateUpdated = time.Now()
	return
}

/* ============= USERS MODEL ============ */

type Users struct {
	UserID                  uuid.UUID `gorm:"primaryKey"`
	EncodedBy               uuid.UUID
	CompanyId               uuid.UUID
	UserType                string `gorm:"default:genesis_admin"`
	Username                string
	Password                string
	Email                   string
	FirstName               string
	LastName                string
	MiddleName              string
	DateOfBirth             string
	EmailVerificationStatus bool `gorm:"default:false"`
	ContactNo               string
	DateRegistered          time.Time
	DateUpdated             time.Time
	Status                  string
}

func (u *Users) BeforeCreate(tx *gorm.DB) (err error) {
	u.UserID = uuid.New()
	u.DateRegistered = time.Now()
	u.DateUpdated = time.Now()
	if u.EncodedBy != uuid.Nil {
		u.UserType = "admin"
	} else {
		u.UserType = "genesis_admin"
	}
	u.EmailVerificationStatus = false
	u.Status = "Active"
	return
}

/* ========= SUBSCRIPTIONS MODEL ========= */

type Subscriptions struct {
	SubscriptionId uuid.UUID `gorm:"primaryKey"`
	CompanyId      uuid.UUID
	DateCreated    time.Time
	DateUpdated    time.Time
}

func (s *Subscriptions) BeforeCreate(tx *gorm.DB) (err error) {
	s.SubscriptionId = uuid.New()
	s.DateCreated = time.Now()
	s.DateUpdated = time.Now()
	return
}

/* ========= LOGIN  =========*/
type LoginRequest struct {
	Username string
	Password string
}

type LoginResponse struct {
	UserID     uuid.UUID
	Username   string
	Email      string
	FirstName  string
	LastName   string
	Token      string
	MiddleName string
}

type AccountListItem struct {
	UserID         uuid.UUID `json:"user_id"`
	Username       string    `json:"username"`
	Email          string    `json:"email"`
	FirstName      string    `json:"first_name"`
	LastName       string    `json:"last_name"`
	MiddleName     string    `json:"middle_name"`
	DateOfBirth    string    `json:"date_of_birth"`
	UserType       string    `json:"user_type"`
	ContactNo      string    `json:"contact_no"`
	Status         string    `json:"status"`
	DateRegistered time.Time `json:"date_registered"`
}
