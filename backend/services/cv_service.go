package services

import (
	"backend/config"
	"backend/models"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CVService struct{}

func NewCVService() *CVService {
	return &CVService{}
}

func (s *CVService) ViewCheckVouchers(userID string) ([]models.CheckVoucher, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var vouchers []models.CheckVoucher
	err = config.DB.
		Model(&models.CheckVoucher{}).
		Where("company_id = ?", user.CompanyId).
		Preload("Supplier").
		Preload("PreparedByUser").
		Preload("Items").
		Preload("Items.Customer").
		Order("created_at DESC").
		Find(&vouchers).Error
	if err != nil {
		return nil, err
	}

	return vouchers, nil
}

func (s *CVService) CreateCheckVoucher(userID string, req models.CreateCheckVoucherRequest) (*models.CheckVoucher, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	if len(req.Items) == 0 {
		return nil, errors.New("items are required")
	}

	voucher := &models.CheckVoucher{
		SupplierID: req.SupplierID,
		CompanyID:  user.CompanyId,
		PreparedBy: &uid,
		Status:     "awaiting approval",
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(voucher).Error; err != nil {
			return err
		}

		items := make([]models.CheckVoucherItem, 0, len(req.Items))
		for _, item := range req.Items {
			items = append(items, models.CheckVoucherItem{
				CheckVoucherID: voucher.ID,
				AccountID:      item.AccountID,
				CustomerID:     item.CustomerID,
				Debit:          item.Debit,
				Credit:         item.Credit,
				VatTypeID:      item.VatTypeID,
				LineNo:         item.LineNo,
			})
		}

		if err := tx.Create(&items).Error; err != nil {
			return err
		}

		voucher.Items = items
		return nil
	})
	if err != nil {
		return nil, err
	}

	return voucher, nil
}

//todo create the function here to update the data for inventory, you can copy the code format of 