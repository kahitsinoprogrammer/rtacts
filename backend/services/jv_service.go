package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type JVService struct{}

func NewJVService() *JVService {
	return &JVService{}
}

func (s *JVService) GetCreateLookups(userID string) (*models.CheckVoucherLookupsResponse, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	suppliers, err := buildSupplierLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	accounts, err := buildAccountLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	return &models.CheckVoucherLookupsResponse{
		Suppliers: suppliers,
		Accounts:  accounts,
	}, nil
}

func (s *JVService) ViewJournalVouchers(userID string) ([]models.JournalVoucher, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	var vouchers []models.JournalVoucher
	err = config.DB.
		Model(&models.JournalVoucher{}).
		Where("company_id = ?", user.CompanyId).
		Preload("Supplier").
		Preload("PreparedByUser").
		Preload("ApprovedByUser").
		Preload("Items").
		Preload("Items.Account").
		Order("created_at DESC").
		Find(&vouchers).Error
	if err != nil {
		return nil, err
	}

	return vouchers, nil
}

func (s *JVService) CreateJournalVoucher(userID string, req models.CreateJournalVoucherRequest) (*models.JournalVoucher, error) {
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

	remarks := normalizeOptionalString(req.Remarks)

	voucher := &models.JournalVoucher{
		SupplierID: req.SupplierID,
		CompanyID:  user.CompanyId,
		PreparedBy: &uid,
		Status:     "awaiting approval",
		Remarks:    remarks,
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(voucher).Error; err != nil {
			return err
		}

		items := make([]models.JournalVoucherItem, 0, len(req.Items))
		for _, item := range req.Items {
			items = append(items, models.JournalVoucherItem{
				JournalVoucherID: voucher.ID,
				AccountID:        item.AccountID,
				Debit:            item.Debit,
				Credit:           item.Credit,
				VatTypeID:        item.VatTypeID,
				LineNo:           item.LineNo,
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

func (s *JVService) DownloadApprovedJournalVoucherExcel(userID string, voucherID string) ([]byte, string, error) {
	user, err := getCurrentUserByID(strings.TrimSpace(userID))
	if err != nil {
		return nil, "", err
	}

	voucherID = strings.TrimSpace(voucherID)
	if voucherID == "" {
		return nil, "", errors.New("journal voucher id is required")
	}

	voucher, err := s.getVoucherForExport(user.CompanyId, voucherID)
	if err != nil {
		return nil, "", err
	}

	if !strings.EqualFold(strings.TrimSpace(voucher.Status), "Approved") {
		return nil, "", errors.New("journal voucher must be approved before downloading")
	}

	company, err := s.getCompanyByID(voucher.CompanyID)
	if err != nil {
		return nil, "", err
	}

	fileBytes, err := buildCheckVoucherExcel(journalVoucherToExportVoucher(voucher), company, "Journal Voucher")
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("journal_voucher_%s.xlsx", sanitizeFilename(voucher.ID))
	return fileBytes, filename, nil
}

func (s *JVService) UpdateJournalVoucherStatus(userID string, voucherID string, req models.UpdateJournalVoucherStatusRequest) error {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return err
	}

	voucherID = strings.TrimSpace(voucherID)
	if voucherID == "" {
		return errors.New("journal voucher id is required")
	}

	status := strings.TrimSpace(strings.ToLower(req.Status))
	if status == "" {
		return errors.New("status is required")
	}

	rejectRemarks := strings.TrimSpace(derefOptionalString(req.RejectRemarks))

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var voucher models.JournalVoucher
		if err := tx.
			Where("id = ? AND company_id = ?", voucherID, user.CompanyId).
			First(&voucher).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("journal voucher not found")
			}
			return err
		}

		currentStatus := strings.TrimSpace(strings.ToLower(voucher.Status))
		if currentStatus == "approved" || currentStatus == "rejected" {
			return errors.New("journal voucher has already been finalized")
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

		return tx.Model(&models.JournalVoucher{}).
			Where("id = ? AND company_id = ?", voucherID, user.CompanyId).
			Updates(updates).Error
	})
}

func (s *JVService) getVoucherForExport(companyID uuid.UUID, voucherID string) (models.JournalVoucher, error) {
	var voucher models.JournalVoucher
	err := config.DB.
		Where("id = ? AND company_id = ?", voucherID, companyID).
		Preload("Supplier").
		Preload("PreparedByUser").
		Preload("ApprovedByUser").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("line_no ASC")
		}).
		Preload("Items.Account").
		First(&voucher).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.JournalVoucher{}, errors.New("journal voucher not found")
		}
		return models.JournalVoucher{}, err
	}

	return voucher, nil
}

func (s *JVService) getCompanyByID(companyID uuid.UUID) (models.Companies, error) {
	var company models.Companies
	if err := config.DB.Where("company_id = ?", companyID).First(&company).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Companies{}, errors.New("company not found")
		}
		return models.Companies{}, err
	}

	return company, nil
}

func journalVoucherToExportVoucher(voucher models.JournalVoucher) models.CheckVoucher {
	items := make([]models.CheckVoucherItem, 0, len(voucher.Items))
	for _, item := range voucher.Items {
		items = append(items, models.CheckVoucherItem{
			ID:             item.ID,
			CheckVoucherID: item.JournalVoucherID,
			AccountID:      item.AccountID,
			Account:        item.Account,
			Debit:          item.Debit,
			Credit:         item.Credit,
			VatTypeID:      item.VatTypeID,
			LineNo:         item.LineNo,
		})
	}

	return models.CheckVoucher{
		ID:             voucher.ID,
		SupplierID:     voucher.SupplierID,
		CompanyID:      voucher.CompanyID,
		PreparedBy:     voucher.PreparedBy,
		ApprovedBy:     voucher.ApprovedBy,
		Status:         voucher.Status,
		ApprovedDate:   voucher.ApprovedDate,
		Remarks:        voucher.Remarks,
		RejectRemarks:  voucher.RejectRemarks,
		CreatedAt:      voucher.CreatedAt,
		UpdatedAt:      voucher.UpdatedAt,
		Supplier:       voucher.Supplier,
		PreparedByUser: voucher.PreparedByUser,
		ApprovedByUser: voucher.ApprovedByUser,
		Items:          items,
	}
}
