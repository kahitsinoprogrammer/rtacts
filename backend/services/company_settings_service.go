package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"net/url"
	"strings"
	"time"

	"gorm.io/gorm"
)

var ErrCompanySettingsForbidden = errors.New("only genesis_admin can manage company settings")

type CompanySettingsService struct{}

func NewCompanySettingsService() *CompanySettingsService {
	return &CompanySettingsService{}
}

func (s *CompanySettingsService) GetCompanySettings(currentUserID string) (models.CompanySettingsResponse, error) {
	currentUser, err := getCurrentUserByID(strings.TrimSpace(currentUserID))
	if err != nil {
		return models.CompanySettingsResponse{}, err
	}

	if currentUser.UserType != "genesis_admin" {
		return models.CompanySettingsResponse{}, ErrCompanySettingsForbidden
	}

	company, err := s.getCompany(currentUser.CompanyId)
	if err != nil {
		return models.CompanySettingsResponse{}, err
	}

	return companyToSettings(company), nil
}

func (s *CompanySettingsService) UpdateCompanySettings(currentUserID string, req models.UpdateCompanySettingsRequest) (models.CompanySettingsResponse, error) {
	currentUser, err := getCurrentUserByID(strings.TrimSpace(currentUserID))
	if err != nil {
		return models.CompanySettingsResponse{}, err
	}

	if currentUser.UserType != "genesis_admin" {
		return models.CompanySettingsResponse{}, ErrCompanySettingsForbidden
	}

	companyName := strings.TrimSpace(req.CompanyName)
	tin := strings.TrimSpace(req.Tin)
	companyEmail := strings.TrimSpace(req.CompanyEmail)
	companyPhone := strings.TrimSpace(req.CompanyPhone)
	companyPic := strings.TrimSpace(req.CompanyPic)
	blockNo := strings.TrimSpace(req.BlockNo)
	city := strings.TrimSpace(req.City)
	province := strings.TrimSpace(req.Province)
	country := strings.TrimSpace(req.Country)
	zipCode := strings.TrimSpace(req.Zip)
	companyAddress := buildCompanyAddressFromParts(blockNo, city, province, country, zipCode)
	if companyAddress == "" {
		companyAddress = strings.TrimSpace(req.CompanyAddress)
	}

	if companyName == "" {
		return models.CompanySettingsResponse{}, errors.New("company_name is required")
	}
	if len(companyName) > 255 {
		return models.CompanySettingsResponse{}, errors.New("company_name must not exceed 255 characters")
	}
	if len(companyEmail) > 255 {
		return models.CompanySettingsResponse{}, errors.New("company_email must not exceed 255 characters")
	}
	if len(tin) > 100 {
		return models.CompanySettingsResponse{}, errors.New("tin must not exceed 100 characters")
	}
	if companyEmail != "" && !emailRegex.MatchString(companyEmail) {
		return models.CompanySettingsResponse{}, errors.New("invalid company_email")
	}
	if len(companyPhone) > 50 {
		return models.CompanySettingsResponse{}, errors.New("company_phone must not exceed 50 characters")
	}
	if len(companyAddress) > 2000 {
		return models.CompanySettingsResponse{}, errors.New("company_address must not exceed 2000 characters")
	}
	if len(companyPic) > 2000 {
		return models.CompanySettingsResponse{}, errors.New("company_pic must not exceed 2000 characters")
	}
	if len(blockNo) > 100 {
		return models.CompanySettingsResponse{}, errors.New("block_no must not exceed 100 characters")
	}
	if len(city) > 150 {
		return models.CompanySettingsResponse{}, errors.New("city must not exceed 150 characters")
	}
	if len(province) > 150 {
		return models.CompanySettingsResponse{}, errors.New("province must not exceed 150 characters")
	}
	if len(country) > 150 {
		return models.CompanySettingsResponse{}, errors.New("country must not exceed 150 characters")
	}
	if len(zipCode) > 20 {
		return models.CompanySettingsResponse{}, errors.New("zip must not exceed 20 characters")
	}
	if companyPic != "" {
		parsedURL, err := url.ParseRequestURI(companyPic)
		if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
			return models.CompanySettingsResponse{}, errors.New("invalid company_pic")
		}
	}

	now := time.Now().UTC()
	err = config.DB.Model(&models.Companies{}).
		Where("company_id = ?", currentUser.CompanyId).
		Updates(map[string]interface{}{
			"company_name":  companyName,
			"tin":           tin,
			"company_email": companyEmail,
			"company_phone": companyPhone,
			"company_pic":   companyPic,
			"block_no":      blockNo,
			"city":          city,
			"province":      province,
			"country":       country,
			"zip":           zipCode,
			"date_updated":  now,
		}).Error
	if err != nil {
		return models.CompanySettingsResponse{}, err
	}

	updatedCompany, err := s.getCompany(currentUser.CompanyId)
	if err != nil {
		return models.CompanySettingsResponse{}, err
	}

	return companyToSettings(updatedCompany), nil
}

func (s *CompanySettingsService) getCompany(companyID interface{}) (models.Companies, error) {
	var company models.Companies
	if err := config.DB.Where("company_id = ?", companyID).First(&company).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Companies{}, errors.New("company not found")
		}
		return models.Companies{}, err
	}

	return company, nil
}

func buildCompanyAddress(company models.Companies) string {
	return buildCompanyAddressFromParts(
		strings.TrimSpace(company.BlockNo),
		strings.TrimSpace(company.City),
		strings.TrimSpace(company.Province),
		strings.TrimSpace(company.Country),
		strings.TrimSpace(company.Zip),
	)
}

func buildCompanyAddressFromParts(blockNo string, city string, province string, country string, zipCode string) string {
	addressParts := []string{blockNo, city, province, country, zipCode}
	filtered := make([]string, 0, len(addressParts))
	for _, part := range addressParts {
		if part != "" {
			filtered = append(filtered, part)
		}
	}

	return strings.Join(filtered, ", ")
}

func companyToSettings(company models.Companies) models.CompanySettingsResponse {
	settings := models.CompanySettingsResponse{
		CompanyID:      company.CompanyId,
		CompanyName:    strings.TrimSpace(company.CompanyName),
		Tin:            strings.TrimSpace(company.Tin),
		CompanyEmail:   strings.TrimSpace(company.CompanyEmail),
		CompanyPhone:   strings.TrimSpace(company.CompanyPhone),
		CompanyAddress: buildCompanyAddress(company),
		CompanyPic:     strings.TrimSpace(company.CompanyPic),
		BlockNo:        strings.TrimSpace(company.BlockNo),
		City:           strings.TrimSpace(company.City),
		Province:       strings.TrimSpace(company.Province),
		Country:        strings.TrimSpace(company.Country),
		Zip:            strings.TrimSpace(company.Zip),
		DateCreated:    company.DateRegistered,
		DateUpdated:    company.DateUpdated,
	}

	return settings
}
