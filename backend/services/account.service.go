package services

import (
	"backend/config"
	"backend/models"
	"errors"
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
		Select("user_id, username, email, first_name, last_name, middle_name, user_type, contact_no, status, date_registered").
		Where("company_id = ?", currentUser.CompanyId).
		Order("date_registered DESC").
		Scan(&users).Error
	if err != nil {
		return nil, err
	}

	return users, nil
}
