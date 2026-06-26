package services

import (
	"backend/config"
	"backend/models"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
)

func getCurrentUserByID(userID string) (models.Users, error) {
	var user models.Users

	uid, err := uuid.Parse(userID)
	if err != nil {
		return user, errors.New("invalid user id")
	}

	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return user, errors.New("user not found")
	}

	return user, nil
}

func buildAccountLookupOptions(companyID uuid.UUID) ([]models.LookupOption, error) {
	var accounts []models.Coa
	if err := config.DB.
		Model(&models.Coa{}).
		Where("company_id = ?", companyID).
		Order("id ASC").
		Find(&accounts).Error; err != nil {
		return nil, err
	}

	options := make([]models.LookupOption, 0, len(accounts))
	for _, account := range accounts {
		accountID := strconv.Itoa(account.ID)
		accountName := strings.TrimSpace(account.AccountDescription)
		accountLongDesc := strings.TrimSpace(account.AccountLongDesc)
		label := accountName
		if accountLongDesc != "" {
			label = fmt.Sprintf("%s - %s", accountName, accountLongDesc)
		}

		options = append(options, models.LookupOption{
			Value:      accountID,
			Label:      label,
			SearchText: strings.ToLower(fmt.Sprintf("%s %s %s", accountName, accountLongDesc, accountID)),
		})
	}

	return options, nil
}

func buildSupplierLookupOptions(companyID uuid.UUID) ([]models.SupplierLookupOption, error) {
	var suppliers []models.Supplier
	if err := config.DB.
		Model(&models.Supplier{}).
		Where("company_id = ?", companyID).
		Order("supplier_name ASC").
		Find(&suppliers).Error; err != nil {
		return nil, err
	}

	options := make([]models.SupplierLookupOption, 0, len(suppliers))
	for _, supplier := range suppliers {
		supplierID := supplier.SupplierID.String()
		supplierName := strings.TrimSpace(supplier.SupplierName)
		supplierEmail := strings.TrimSpace(supplier.Email)
		label := supplierName
		if supplierEmail != "" {
			label = fmt.Sprintf("%s (%s)", supplierName, supplierEmail)
		}

		options = append(options, models.SupplierLookupOption{
			Value:         supplierID,
			Label:         label,
			SearchText:    strings.ToLower(fmt.Sprintf("%s %s", supplierName, supplierEmail)),
			ContactPerson: strings.TrimSpace(supplier.ContactPerson),
		})
	}

	return options, nil
}

func buildCustomerLookupOptions(companyID uuid.UUID) ([]models.LookupOption, error) {
	var customers []models.Customer
	if err := config.DB.
		Model(&models.Customer{}).
		Where("company_id = ?", companyID).
		Order("customer_name ASC").
		Find(&customers).Error; err != nil {
		return nil, err
	}

	options := make([]models.LookupOption, 0, len(customers))
	for _, customer := range customers {
		customerID := customer.CustomerID.String()
		customerName := strings.TrimSpace(customer.CustomerName)
		customerEmail := strings.TrimSpace(customer.Email)
		label := customerName
		if customerEmail != "" {
			label = fmt.Sprintf("%s (%s)", customerName, customerEmail)
		}

		options = append(options, models.LookupOption{
			Value:      customerID,
			Label:      label,
			SearchText: strings.ToLower(fmt.Sprintf("%s %s", customerName, customerEmail)),
		})
	}

	return options, nil
}
