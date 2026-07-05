package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"strings"

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

		items := make([]models.InvoiceItem, 0, len(req.Items))
		for index, item := range req.Items {
			if item.ProductID == uuid.Nil {
				return errors.New("product_id is required")
			}
			if item.Quantity <= 0 {
				return errors.New("quantity must be greater than zero")
			}

			var product models.Inventory
			if err := tx.
				Where("product_code = ? AND company_id = ?", item.ProductID, user.CompanyId).
				First(&product).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return errors.New("product not found")
				}
				return err
			}

			unitPrice := item.UnitPrice
			if unitPrice == 0 {
				unitPrice = product.CostPerUnit
			}
			if unitPrice < 0 {
				return errors.New("unit_price cannot be negative")
			}

			taxType, err := item.TaxType.Normalize()
			if err != nil {
				return err
			}

			amount := item.Quantity * unitPrice
			lineNo := item.LineNo
			if lineNo < 1 {
				lineNo = index + 1
			}

			items = append(items, models.InvoiceItem{
				InvoiceID:   invoice.ID,
				ProductID:   item.ProductID,
				LineNo:      lineNo,
				Quantity:    item.Quantity,
				Amount:      amount,
				TotalAmount: amount,
				TaxType:     taxType,
				UnitPrice:   unitPrice,
			})
		}

		if err := tx.Create(&items).Error; err != nil {
			return err
		}

		invoice.Items = items
		createdInvoice = invoice
		return nil
	})
	if err != nil {
		return nil, err
	}

	return createdInvoice, nil
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

	return invoices, nil
}
