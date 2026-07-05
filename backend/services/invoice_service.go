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

type InvoiceService struct{}

func NewInvoiceService() *InvoiceService {
	return &InvoiceService{}
}

func (s *InvoiceService) GetCreateLookups(userID string) (*models.InvoiceLookupsResponse, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	customers, err := buildCustomerLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	products, err := buildProductLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	return &models.InvoiceLookupsResponse{
		Customers: customers,
		Products:  products,
	}, nil
}

func (s *InvoiceService) PreviewInvoice(userID string, req models.PreviewInvoiceRequest) (*models.PreviewInvoiceResponse, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	items, totalAmount, err := s.computeInvoiceItems(config.DB, user.CompanyId, req.Items, false)
	if err != nil {
		return nil, err
	}

	return &models.PreviewInvoiceResponse{
		Items:       toPreviewInvoiceItems(items),
		TotalAmount: totalAmount,
	}, nil
}

func (s *InvoiceService) CreateInvoice(userID string, req models.CreateInvoiceRequest) (*models.Invoice, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	customer := strings.TrimSpace(req.Customer)
	if customer == "" {
		return nil, errors.New("customer is required")
	}
	if len(customer) > 255 {
		return nil, errors.New("customer must not exceed 255 characters")
	}
	if len(req.Items) == 0 {
		return nil, errors.New("items are required")
	}

	var createdInvoice *models.Invoice
	err = config.DB.Transaction(func(tx *gorm.DB) error {
		invoice := &models.Invoice{
			Customer:   customer,
			PreparedBy: &user.UserID,
			Status:     "awaiting approval",
		}

		if err := tx.Create(invoice).Error; err != nil {
			return err
		}

		items, totalAmount, err := s.computeInvoiceItems(tx, user.CompanyId, req.Items, true)
		if err != nil {
			return err
		}

		for index := range items {
			items[index].InvoiceID = invoice.ID
		}

		if err := tx.Create(&items).Error; err != nil {
			return err
		}

		invoice.Items = items
		invoice.TotalAmount = totalAmount
		createdInvoice = invoice
		return nil
	})
	if err != nil {
		return nil, err
	}

	return createdInvoice, nil
}

func (s *InvoiceService) UpdateInvoiceStatus(userID string, invoiceID string, req models.UpdateInvoiceStatusRequest) error {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return err
	}

	invoiceID = strings.TrimSpace(invoiceID)
	if invoiceID == "" {
		return errors.New("invoice id is required")
	}

	status := strings.TrimSpace(strings.ToLower(req.Status))
	if status == "" {
		return errors.New("status is required")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var invoice models.Invoice
		if err := tx.
			Model(&models.Invoice{}).
			Joins("JOIN users prepared_users ON prepared_users.user_id = invoice.prepared_by").
			Where("invoice.id = ? AND prepared_users.company_id = ?", invoiceID, user.CompanyId).
			First(&invoice).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("invoice not found")
			}
			return err
		}

		currentStatus := strings.TrimSpace(strings.ToLower(invoice.Status))
		if currentStatus == "approved" || currentStatus == "rejected" {
			return errors.New("invoice has already been finalized")
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
		case "rejected":
			updates["status"] = "Rejected"
			updates["approved_by"] = nil
			updates["approved_date"] = nil
		default:
			return errors.New("status must be Approved or Rejected")
		}

		return tx.Model(&models.Invoice{}).
			Where("id = ?", invoiceID).
			Updates(updates).Error
	})
}

func (s *InvoiceService) ViewInvoices(userID string) ([]models.Invoice, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	var invoices []models.Invoice
	err = config.DB.
		Model(&models.Invoice{}).
		Joins("JOIN users prepared_users ON prepared_users.user_id = invoice.prepared_by").
		Where("prepared_users.company_id = ?", user.CompanyId).
		Preload("PreparedByUser").
		Preload("ApprovedByUser").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("line_no ASC")
		}).
		Preload("Items.Product").
		Order("invoice.created_at DESC").
		Find(&invoices).Error
	if err != nil {
		return nil, err
	}

	for index := range invoices {
		invoices[index].TotalAmount = sumInvoiceItems(invoices[index].Items)
	}

	return invoices, nil
}

func (s *InvoiceService) computeInvoiceItems(
	tx *gorm.DB,
	companyID uuid.UUID,
	reqItems []models.CreateInvoiceItemRequest,
	strict bool,
) ([]models.InvoiceItem, float64, error) {
	items := make([]models.InvoiceItem, 0, len(reqItems))
	totalAmount := 0.0

	for index, item := range reqItems {
		lineNo := item.LineNo
		if lineNo < 1 {
			lineNo = index + 1
		}

		taxType, err := item.TaxType.Normalize()
		if err != nil {
			if strict {
				return nil, 0, err
			}
			taxType = models.InvoiceTaxTypeVatable
		}

		computedItem := models.InvoiceItem{
			ProductID: item.ProductID,
			LineNo:    lineNo,
			Quantity:  item.Quantity,
			TaxType:   taxType,
		}

		if item.ProductID == uuid.Nil {
			if strict {
				return nil, 0, errors.New("product_id is required")
			}
			items = append(items, computedItem)
			continue
		}

		var product models.Inventory
		if err := tx.
			Where("product_code = ? AND company_id = ?", item.ProductID, companyID).
			First(&product).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if strict {
					return nil, 0, errors.New("product not found")
				}
				items = append(items, computedItem)
				continue
			}
			return nil, 0, err
		}

		unitPrice := product.CostPerUnit
		if unitPrice < 0 {
			if strict {
				return nil, 0, errors.New("inventory product has an invalid unit price")
			}
			unitPrice = 0
		}

		if strict && item.Quantity <= 0 {
			return nil, 0, errors.New("quantity must be greater than zero")
		}

		amount := 0.0
		if item.Quantity > 0 {
			amount = item.Quantity * unitPrice
		}

		computedItem.UnitPrice = unitPrice
		computedItem.Amount = amount
		computedItem.TotalAmount = amount

		totalAmount += amount
		items = append(items, computedItem)
	}

	return items, totalAmount, nil
}

func toPreviewInvoiceItems(items []models.InvoiceItem) []models.PreviewInvoiceItem {
	previewItems := make([]models.PreviewInvoiceItem, 0, len(items))
	for _, item := range items {
		previewItems = append(previewItems, models.PreviewInvoiceItem{
			ProductID:   item.ProductID,
			LineNo:      item.LineNo,
			Quantity:    item.Quantity,
			UnitPrice:   item.UnitPrice,
			Amount:      item.Amount,
			TotalAmount: item.TotalAmount,
			TaxType:     item.TaxType,
		})
	}
	return previewItems
}

func sumInvoiceItems(items []models.InvoiceItem) float64 {
	totalAmount := 0.0
	for _, item := range items {
		totalAmount += item.TotalAmount
	}
	return totalAmount
}
