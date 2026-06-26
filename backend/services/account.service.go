package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AccountService struct{}

func NewAccountService() *AccountService {
	return &AccountService{}
}

/* ================================
   ========== CREATE ACCOUNT ======
   ================================ */

func (s *AccountService) CreateAccount(req models.CreateAccountRequest, creatorUserID string) (models.Companies, models.Users, error) {

	tx := config.DB.Begin()
	var company models.Companies
	var creator models.Users
	isAdminCreate := false

	if creatorUserID != "" {
		uid, err := uuid.Parse(creatorUserID)
		if err != nil {
			tx.Rollback()
			return company, models.Users{}, err
		}

		if err := tx.Where("user_id = ?", uid).First(&creator).Error; err != nil {
			tx.Rollback()
			return company, models.Users{}, err
		}

		isAdminCreate = true
	} else {
		// Genesis account flow: create a fresh company
		if err := tx.Create(&company).Error; err != nil {
			tx.Rollback()
			return company, models.Users{}, err
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		tx.Rollback()
		return company, models.Users{}, err
	}

	// Create user
	user := models.Users{
		Username:    req.Username,
		Password:    string(hashedPassword),
		Email:       req.Email,
		FirstName:   req.FirstName,
		LastName:    req.LastName,
		MiddleName:  req.MiddleName,
		DateOfBirth: req.DateOfBirth,
		ContactNo:   req.ContactNo,
	}

	if isAdminCreate {
		user.CompanyId = creator.CompanyId
		user.EncodedBy = creator.UserID
	} else {
		user.CompanyId = company.CompanyId
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return company, user, err
	}

	// Genesis account only: create subscription for the new company
	if !isAdminCreate {
		sub := models.Subscriptions{
			CompanyId: company.CompanyId,
		}

		if err := tx.Create(&sub).Error; err != nil {
			tx.Rollback()
			return company, user, err
		}
	}

	tx.Commit()
	return company, user, nil
}

/* ================================
   ============ VERIFY OTP ========
   ================================ */

func (s *AccountService) VerifyOTP(req models.VerifyOTPRequest) error {
	if req.OTP != "123456" {
		return errors.New("invalid OTP")
	}

	// Update user email verification status
	if err := config.DB.Model(&models.Users{}).
		Where("user_id = ?", req.UserID).
		Update("email_verification_status", true).Error; err != nil {
		return err
	}

	return nil
}

func (s *AccountService) Login(req models.LoginRequest) (models.Users, error) {

	// 1. Find the user
	var user models.Users
	if err := config.DB.Where("username = ?", req.Username).First(&user).Error; err != nil {
		return user, errors.New("invalid username or password")
	}

	// 2. Compare the hashed password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return user, errors.New("invalid username or password")
	}

	// 3. Return user (or generate JWT later)
	return user, nil
}

func (s *AccountService) FindByID(userID string) (models.Users, error) {
	var user models.Users

	// 1. Parse the string UUID from token into uuid.UUID type
	uid, err := uuid.Parse(userID)
	if err != nil {
		return user, errors.New("invalid user id")
	}

	// 2. Query by user_id (GORM maps UserID -> user_id, but we can be explicit)
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return user, errors.New("user not found")
		}
		return user, err
	}

	// 3. Return the found user
	return user, nil
}

func (s *AccountService) ViewAccounts(userID string) ([]models.AccountListItem, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var currentUser models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&currentUser).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	var users []models.AccountListItem
	err = config.DB.
		Model(&models.Users{}).
		Select("user_id, username, email, first_name, last_name, middle_name, date_of_birth, user_type, contact_no, status, date_registered").
		Where("company_id = ?", currentUser.CompanyId).
		Order("date_registered DESC").
		Scan(&users).Error
	if err != nil {
		return nil, err
	}

	return users, nil
}

func (s *AccountService) UpdateAccount(currentUserID string, targetUserID string, req models.UpdateAccountRequest) error {
	currentUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return errors.New("invalid user id")
	}

	targetUID, err := uuid.Parse(strings.TrimSpace(targetUserID))
	if err != nil {
		return errors.New("invalid account id")
	}

	var currentUser models.Users
	if err := config.DB.Where("user_id = ?", currentUID).First(&currentUser).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return err
	}

	username := strings.TrimSpace(derefAccountString(req.Username))
	email := strings.TrimSpace(derefAccountString(req.Email))
	firstName := strings.TrimSpace(derefAccountString(req.FirstName))
	lastName := strings.TrimSpace(derefAccountString(req.LastName))
	middleName := strings.TrimSpace(derefAccountString(req.MiddleName))
	dateOfBirth := strings.TrimSpace(derefAccountString(req.DateOfBirth))
	contactNo := strings.TrimSpace(derefAccountString(req.ContactNo))

	if username == "" {
		return errors.New("username is required")
	}
	if email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email")
	}
	if firstName == "" {
		return errors.New("first_name is required")
	}
	if lastName == "" {
		return errors.New("last_name is required")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var targetUser models.Users
		if err := tx.Where("user_id = ? AND company_id = ?", targetUID, currentUser.CompanyId).First(&targetUser).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("account not found")
			}
			return err
		}

		var count int64
		if err := tx.Model(&models.Users{}).
			Where("company_id = ? AND lower(username) = lower(?) AND user_id <> ?", currentUser.CompanyId, username, targetUID).
			Count(&count).Error; err != nil {
			return errors.New("failed checking username uniqueness")
		}
		if count > 0 {
			return errors.New("username already exists")
		}

		count = 0
		if err := tx.Model(&models.Users{}).
			Where("company_id = ? AND lower(email) = lower(?) AND user_id <> ?", currentUser.CompanyId, email, targetUID).
			Count(&count).Error; err != nil {
			return errors.New("failed checking email uniqueness")
		}
		if count > 0 {
			return errors.New("email already exists")
		}

		status := targetUser.Status
		if req.IsActive != nil {
			if *req.IsActive {
				status = "Active"
			} else {
				status = "Inactive"
			}
		}

		updates := map[string]interface{}{
			"username":      username,
			"email":         email,
			"first_name":    firstName,
			"last_name":     lastName,
			"middle_name":   middleName,
			"date_of_birth": dateOfBirth,
			"contact_no":    contactNo,
			"status":        status,
			"date_updated":  time.Now().UTC(),
		}

		return tx.Model(&models.Users{}).
			Where("user_id = ? AND company_id = ?", targetUID, currentUser.CompanyId).
			Updates(updates).Error
	})
}

func derefAccountString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
