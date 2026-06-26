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

type CVService struct{}

func NewCVService() *CVService {
	return &CVService{}
}

func (s *CVService) GetCreateLookups(userID string) (*models.CheckVoucherLookupsResponse, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	suppliers, err := buildSupplierLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	customers, err := buildCustomerLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	accounts, err := buildAccountLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	return &models.CheckVoucherLookupsResponse{
		Suppliers: suppliers,
		Customers: customers,
		Accounts:  accounts,
	}, nil
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

func (s *CVService) UpdateCheckVoucherStatus(userID string, voucherID string, req models.UpdateCheckVoucherStatusRequest) error {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return err
	}

	voucherID = strings.TrimSpace(voucherID)
	if voucherID == "" {
		return errors.New("check voucher id is required")
	}

	status := strings.TrimSpace(strings.ToLower(req.Status))
	if status == "" {
		return errors.New("status is required")
	}

	rejectRemarks := strings.TrimSpace(derefOptionalString(req.RejectRemarks))

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var voucher models.CheckVoucher
		if err := tx.
			Where("id = ? AND company_id = ?", voucherID, user.CompanyId).
			First(&voucher).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("check voucher not found")
			}
			return err
		}

		currentStatus := strings.TrimSpace(strings.ToLower(voucher.Status))
		if currentStatus == "approved" || currentStatus == "rejected" {
			return errors.New("check voucher has already been finalized")
		}

		now := time.Now().UTC()
		updates := map[string]interface{}{
			"updated_at": now,
		}

		switch status {
		case "approved":
			updates["status"] = "Approved"
			updates["approved_by"] = user.UserID
			updates["approved_date"] = now
			updates["reject_remarks"] = nil
		case "rejected":
			if rejectRemarks == "" {
				return errors.New("reject_remarks is required when rejecting")
			}
			updates["status"] = "Rejected"
			updates["approved_by"] = nil
			updates["approved_date"] = nil
			updates["reject_remarks"] = rejectRemarks
		default:
			return errors.New("status must be Approved or Rejected")
		}

		return tx.Model(&models.CheckVoucher{}).
			Where("id = ? AND company_id = ?", voucherID, user.CompanyId).
			Updates(updates).Error
	})
}

func derefOptionalString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
