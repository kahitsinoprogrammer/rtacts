package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var ErrCompanySettingsForbidden = errors.New("only genesis_admin can manage company settings")

type CompanySettingsService struct{}

func NewCompanySettingsService() *CompanySettingsService {
	return &CompanySettingsService{}
}

func (s *CompanySettingsService) GetCompanySettings(currentUserID string) (models.CompanySettings, error) {
	currentUser, err := s.getCurrentUser(currentUserID)
	if err != nil {
		return models.CompanySettings{}, err
	}

	if currentUser.UserType != "genesis_admin" {
		return models.CompanySettings{}, ErrCompanySettingsForbidden
	}

	var settings models.CompanySettings
	if err := config.DB.Where("company_id = ?", currentUser.CompanyId).First(&settings).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.CompanySettings{
				CompanyID: currentUser.CompanyId,
			}, nil
		}
		return models.CompanySettings{}, err
	}

	return settings, nil
}

func (s *CompanySettingsService) UpdateCompanySettings(currentUserID string, req models.UpdateCompanySettingsRequest) (models.CompanySettings, error) {
	currentUser, err := s.getCurrentUser(currentUserID)
	if err != nil {
		return models.CompanySettings{}, err
	}

	if currentUser.UserType != "genesis_admin" {
		return models.CompanySettings{}, ErrCompanySettingsForbidden
	}

	companyName := strings.TrimSpace(req.CompanyName)
	companyEmail := strings.TrimSpace(req.CompanyEmail)
	companyPhone := strings.TrimSpace(req.CompanyPhone)
	companyAddress := strings.TrimSpace(req.CompanyAddress)

	if companyName == "" {
		return models.CompanySettings{}, errors.New("company_name is required")
	}
	if len(companyName) > 255 {
		return models.CompanySettings{}, errors.New("company_name must not exceed 255 characters")
	}
	if len(companyEmail) > 255 {
		return models.CompanySettings{}, errors.New("company_email must not exceed 255 characters")
	}
	if companyEmail != "" && !emailRegex.MatchString(companyEmail) {
		return models.CompanySettings{}, errors.New("invalid company_email")
	}
	if len(companyPhone) > 50 {
		return models.CompanySettings{}, errors.New("company_phone must not exceed 50 characters")
	}
	if len(companyAddress) > 2000 {
		return models.CompanySettings{}, errors.New("company_address must not exceed 2000 characters")
	}

	now := time.Now().UTC()
	var settings models.CompanySettings

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Where("company_id = ?", currentUser.CompanyId).First(&settings).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			settings = models.CompanySettings{
				CompanyID:      currentUser.CompanyId,
				CompanyName:    companyName,
				CompanyEmail:   companyEmail,
				CompanyPhone:   companyPhone,
				CompanyAddress: companyAddress,
				DateCreated:    now,
				DateUpdated:    now,
			}

			return tx.Create(&settings).Error
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{
			"company_name":    companyName,
			"company_email":   companyEmail,
			"company_phone":   companyPhone,
			"company_address": companyAddress,
			"date_updated":    now,
		}

		if err := tx.Model(&models.CompanySettings{}).
			Where("company_id = ?", currentUser.CompanyId).
			Updates(updates).Error; err != nil {
			return err
		}

		return tx.Where("company_id = ?", currentUser.CompanyId).First(&settings).Error
	})
	if err != nil {
		return models.CompanySettings{}, err
	}

	return settings, nil
}

func (s *CompanySettingsService) getCurrentUser(userID string) (models.Users, error) {
	uid, err := uuid.Parse(strings.TrimSpace(userID))
	if err != nil {
		return models.Users{}, errors.New("invalid user id")
	}

	var currentUser models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&currentUser).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Users{}, errors.New("user not found")
		}
		return models.Users{}, err
	}

	return currentUser, nil
}
