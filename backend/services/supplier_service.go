package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type SupplierService struct{}

func NewSupplierService() *SupplierService {
	return &SupplierService{}
}

var emailRegex = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func (s *SupplierService) CreateSupplier(userID string, req models.CreateSupplierRequest) error {
	// trim

	req.SupplierName = strings.TrimSpace(req.SupplierName)
	req.Email = strings.TrimSpace(req.Email)

	req.ContactPerson = strings.TrimSpace(req.ContactPerson)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Address = strings.TrimSpace(req.Address)
	req.TaxID = strings.TrimSpace(req.TaxID)

	req.Notes = strings.TrimSpace(req.Notes)

	if req.SupplierName == "" {
		return errors.New("supplier_name is required")
	}
	if req.Email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(req.Email) {
		return errors.New("invalid email")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	// get user's company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		// 1) Uniqueness checks (scoped to company)
		// Choose what you want unique. Common: email unique per company.
		var cnt int64

		// email uniqueness per company
		if err := tx.Model(&models.Supplier{}).
			Where("company_id = ? AND lower(email) = lower(?)", user.CompanyId, req.Email).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking supplier email uniqueness")
		}
		if cnt > 0 {
			return errors.New("supplier email already exists")
		}

		// supplier name uniqueness per company (optional but helpful)
		cnt = 0
		if err := tx.Model(&models.Supplier{}).
			Where("company_id = ? AND lower(supplier_name) = lower(?)", user.CompanyId, req.SupplierName).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking supplier name uniqueness")
		}
		if cnt > 0 {
			return errors.New("supplier name already exists")
		}

		now := time.Now().UTC()

		row := models.Supplier{
			CompanyID: user.CompanyId,

			SupplierName: req.SupplierName,
			Email:        req.Email,

			ContactPerson: req.ContactPerson,
			Phone:         req.Phone,
			Address:       req.Address,
			TaxID:         req.TaxID,

			Notes: req.Notes,

			DateRegistered: now,
			DateUpdated:    now,
		}

		return tx.Create(&row).Error
	})
}

func (s *SupplierService) ViewSupplier(userID string, search string) ([]models.Supplier, error) {
	search = strings.TrimSpace(search)

	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// get user's company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	query := config.DB.
		Model(&models.Supplier{}).
		Where("company_id = ?", user.CompanyId)

	// If search box is empty, return all suppliers under the company.
	if search != "" {
		kw := "%" + strings.ToLower(search) + "%"
		query = query.Where(`
			LOWER(supplier_name) LIKE ? OR
			LOWER(email) LIKE ? OR
			LOWER(contact_person) LIKE ? OR
			LOWER(contact_no) LIKE ? OR
			LOWER(address) LIKE ? OR
			LOWER(tax_id) LIKE ? OR
			LOWER(status) LIKE ? OR
			LOWER(notes) LIKE ?
		`, kw, kw, kw, kw, kw, kw, kw, kw)
	}

	var rows []models.Supplier
	if err := query.
		Order("date_registered DESC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *SupplierService) UpdateSupplier(userID string, supplierID string, req models.UpdateSupplierRequest) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	sid, err := uuid.Parse(strings.TrimSpace(supplierID))
	if err != nil {
		return errors.New("invalid supplier id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	supplierName := strings.TrimSpace(derefString(req.SupplierName))
	email := strings.TrimSpace(derefString(req.Email))
	contactPerson := strings.TrimSpace(derefString(req.ContactPerson))
	phone := strings.TrimSpace(derefString(req.Phone))
	address := strings.TrimSpace(derefString(req.Address))
	taxID := strings.TrimSpace(derefString(req.TaxID))
	notes := strings.TrimSpace(derefString(req.Notes))

	if supplierName == "" {
		return errors.New("supplier_name is required")
	}
	if email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var row models.Supplier
		if err := tx.Where("supplier_id = ? AND company_id = ?", sid, user.CompanyId).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("supplier not found")
			}
			return err
		}

		var cnt int64
		if err := tx.Model(&models.Supplier{}).
			Where("company_id = ? AND lower(email) = lower(?) AND supplier_id <> ?", user.CompanyId, email, sid).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking supplier email uniqueness")
		}
		if cnt > 0 {
			return errors.New("supplier email already exists")
		}

		cnt = 0
		if err := tx.Model(&models.Supplier{}).
			Where("company_id = ? AND lower(supplier_name) = lower(?) AND supplier_id <> ?", user.CompanyId, supplierName, sid).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking supplier name uniqueness")
		}
		if cnt > 0 {
			return errors.New("supplier name already exists")
		}

		status := row.Status
		if req.IsActive != nil {
			if *req.IsActive {
				status = "active"
			} else {
				status = "inactive"
			}
		}

		updates := map[string]interface{}{
			"supplier_name":  supplierName,
			"email":          email,
			"contact_person": contactPerson,
			"phone":          phone,
			"address":        address,
			"tax_id":         taxID,
			"notes":          notes,
			"status":         status,
			"date_updated":   time.Now().UTC(),
		}

		return tx.Model(&models.Supplier{}).
			Where("supplier_id = ? AND company_id = ?", sid, user.CompanyId).
			Updates(updates).Error
	})
}

func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
