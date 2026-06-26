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

type InventoryService struct{}

func NewInventoryService() *InventoryService {
	return &InventoryService{}
}

func (s *InventoryService) GetInventoryLookups(userID string) (*models.InventoryLookupsResponse, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	accountOptions, err := buildAccountLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	return &models.InventoryLookupsResponse{
		AccountOptions: accountOptions,
	}, nil
}

func (s *InventoryService) GetInventoryManageData(userID string) (*models.InventoryManageResponse, error) {
	rows, err := s.ViewInventory(userID)
	if err != nil {
		return nil, err
	}

	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	accountOptions, err := buildAccountLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	return &models.InventoryManageResponse{
		Rows:           rows,
		AccountOptions: accountOptions,
	}, nil
}

func (s *InventoryService) CreateInventory(userID string, req models.CreateInventoryRequest) error {
	req.ProductName = strings.TrimSpace(req.ProductName)
	req.UnitMeasurement = strings.TrimSpace(req.UnitMeasurement)
	req.AccountNumber = strings.TrimSpace(req.AccountNumber)

	if req.ProductName == "" {
		return errors.New("product_name is required")
	}
	if req.CostPerUnit < 0 {
		return errors.New("cost_per_unit cannot be negative")
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
		if err := tx.Model(&models.Inventory{}).
			Where("lower(product_name) = lower(?)", req.ProductName).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking product name uniqueness")
		}
		if cnt > 0 {
			return errors.New("product name already exists")
		}

		now := time.Now().UTC()

		row := models.Inventory{
			CompanyID:       user.CompanyId,
			ProductName:     req.ProductName,
			UnitMeasurement: req.UnitMeasurement,
			CostPerUnit:     req.CostPerUnit,
			AccountNumber:   req.AccountNumber,
			EncodedBy:       uid,
			CreatedAt:       now,
			UpdatedAt:       now,
		}

		return tx.Create(&row).Error
	})
}
func (s *InventoryService) ViewInventory(userID string) ([]models.Inventory, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var inventory []models.Inventory
	err = config.DB.
		Model(&models.Inventory{}).
		Where("company_id = ?", user.CompanyId).
		Preload("Coa").
		Order("created_at DESC").
		Find(&inventory).Error
	if err != nil {
		return nil, err
	}

	return inventory, nil
}

func (s *InventoryService) UpdateInventory(userID string, productCode string, req models.UpdateInventoryRequest) error {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	pid, err := uuid.Parse(strings.TrimSpace(productCode))
	if err != nil {
		return errors.New("invalid product code")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	productName := strings.TrimSpace(derefString(req.ProductName))
	unitMeasurement := strings.TrimSpace(derefString(req.UnitMeasurement))
	accountNumber := strings.TrimSpace(derefString(req.AccountNumber))
	costPerUnit := derefFloat64(req.CostPerUnit)

	if productName == "" {
		return errors.New("product_name is required")
	}
	if costPerUnit < 0 {
		return errors.New("cost_per_unit cannot be negative")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var row models.Inventory
		if err := tx.Where("product_code = ? AND company_id = ?", pid, user.CompanyId).First(&row).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("inventory not found")
			}
			return err
		}

		var cnt int64
		if err := tx.Model(&models.Inventory{}).
			Where("company_id = ? AND lower(product_name) = lower(?) AND product_code <> ?", user.CompanyId, productName, pid).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking product name uniqueness")
		}
		if cnt > 0 {
			return errors.New("product name already exists")
		}

		updates := map[string]interface{}{
			"product_name":     productName,
			"unit_measurement": unitMeasurement,
			"cost_per_unit":    costPerUnit,
			"account_number":   accountNumber,
			"encoded_by":       uid,
			"updated_at":       time.Now().UTC(),
		}

		return tx.Model(&models.Inventory{}).
			Where("product_code = ? AND company_id = ?", pid, user.CompanyId).
			Updates(updates).Error
	})
}

func derefFloat64(v *float64) float64 {
	if v == nil {
		return 0
	}
	return *v
}
