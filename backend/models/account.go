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
	CompanyId      uuid.UUID `gorm:"primaryKey"`
	DateRegistered time.Time
	DateUpdated    time.Time
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
	UserType       string    `json:"user_type"`
	ContactNo      string    `json:"contact_no"`
	Status         string    `json:"status"`
	DateRegistered time.Time `json:"date_registered"`
}
