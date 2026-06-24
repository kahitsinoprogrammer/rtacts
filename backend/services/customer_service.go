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

type CustomerService struct{}

func NewCustomerService() *CustomerService {
	return &CustomerService{}
}

func (s *CustomerService) CreateCustomer(userID string, req models.CreateCustomerRequest) error {
	req.CustomerName = strings.TrimSpace(req.CustomerName)
	req.Email = strings.TrimSpace(req.Email)
	req.ContactPerson = strings.TrimSpace(req.ContactPerson)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Address = strings.TrimSpace(req.Address)
	req.TaxID = strings.TrimSpace(req.TaxID)
	req.Notes = strings.TrimSpace(req.Notes)

	if req.CustomerName == "" {
		return errors.New("customer_name is required")
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

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var cnt int64

		if err := tx.Model(&models.Customer{}).
			Where("company_id = ? AND lower(email) = lower(?)", user.CompanyId, req.Email).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking customer email uniqueness")
		}
		if cnt > 0 {
			return errors.New("customer email already exists")
		}

		cnt = 0
		if err := tx.Model(&models.Customer{}).
			Where("company_id = ? AND lower(customer_name) = lower(?)", user.CompanyId, req.CustomerName).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking customer name uniqueness")
		}
		if cnt > 0 {
			return errors.New("customer name already exists")
		}

		now := time.Now().UTC()

		row := models.Customer{
			CompanyID: user.CompanyId,

			CustomerName: req.CustomerName,
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

func (s *CustomerService) ViewCustomer(userID string, search string) ([]models.Customer, error) {
	search = strings.TrimSpace(search)

	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	query := config.DB.
		Model(&models.Customer{}).
		Where("company_id = ?", user.CompanyId)

	if search != "" {
		kw := "%" + strings.ToLower(search) + "%"
		query = query.Where(`
			LOWER(customer_name) LIKE ? OR
			LOWER(email) LIKE ? OR
			LOWER(contact_person) LIKE ? OR
			LOWER(phone) LIKE ? OR
			LOWER(address) LIKE ? OR
			LOWER(tax_id) LIKE ? OR
			LOWER(status) LIKE ? OR
			LOWER(notes) LIKE ?
		`, kw, kw, kw, kw, kw, kw, kw, kw)
	}

	var rows []models.Customer
	if err := query.
		Order("date_registered DESC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *CustomerService) UpdateCustomer(userID string, customerID string, req models.UpdateCustomerRequest) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	cid, err := uuid.Parse(strings.TrimSpace(customerID))
	if err != nil {
		return errors.New("invalid customer id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	customerName := strings.TrimSpace(derefString(req.CustomerName))
	email := strings.TrimSpace(derefString(req.Email))
	contactPerson := strings.TrimSpace(derefString(req.ContactPerson))
	phone := strings.TrimSpace(derefString(req.Phone))
	address := strings.TrimSpace(derefString(req.Address))
	taxID := strings.TrimSpace(derefString(req.TaxID))
	notes := strings.TrimSpace(derefString(req.Notes))

	if customerName == "" {
		return errors.New("customer_name is required")
	}
	if email == "" {
		return errors.New("email is required")
	}
	if !emailRegex.MatchString(email) {
		return errors.New("invalid email")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var row models.Customer
		if err := tx.Where("customer_id = ? AND company_id = ?", cid, user.CompanyId).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("customer not found")
			}
			return err
		}

		var cnt int64
		if err := tx.Model(&models.Customer{}).
			Where("company_id = ? AND lower(email) = lower(?) AND customer_id <> ?", user.CompanyId, email, cid).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking customer email uniqueness")
		}
		if cnt > 0 {
			return errors.New("customer email already exists")
		}

		cnt = 0
		if err := tx.Model(&models.Customer{}).
			Where("company_id = ? AND lower(customer_name) = lower(?) AND customer_id <> ?", user.CompanyId, customerName, cid).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking customer name uniqueness")
		}
		if cnt > 0 {
			return errors.New("customer name already exists")
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
			"customer_name":  customerName,
			"email":          email,
			"contact_person": contactPerson,
			"phone":          phone,
			"address":        address,
			"tax_id":         taxID,
			"notes":          notes,
			"status":         status,
			"date_updated":   time.Now().UTC(),
		}

		return tx.Model(&models.Customer{}).
			Where("customer_id = ? AND company_id = ?", cid, user.CompanyId).
			Updates(updates).Error
	})
}
