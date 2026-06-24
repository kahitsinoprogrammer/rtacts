package services

import (
	"backend/config"
	"backend/models"
	"bytes"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

type ChartOfAccountsService struct{}

func NewChartOfAccountsService() *ChartOfAccountsService {
	return &ChartOfAccountsService{}
}

func (s *ChartOfAccountsService) CreateAccountType(userID string, accountType string) error {
	accountType = strings.TrimSpace(accountType)
	if accountType == "" {
		return errors.New("accountType is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}



	// get user to get company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	// transaction for safe ID generation + insert
	return config.DB.Transaction(func(tx *gorm.DB) error {
		// 🔒 lock so only 1 transaction can compute next id at a time
		if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", int64(20250101)).Error; err != nil {
			return err
		}

		// get last id
		var lastID int
		if err := tx.Raw("SELECT COALESCE(MAX(id), 0) FROM coa_account_type").Scan(&lastID).Error; err != nil {
			return err
		}

		now := time.Now().UTC()

		row := models.CoaAccountType{
			ID:          lastID + 1,
			Type:        accountType,      // DB column: type
			CompanyID:   user.CompanyId,   // DB column: company_id
			EncodedBy:   uid,   
			DateCreated: now,              // DB column: date_created
			DateUpdated: now,              // DB column: date_updated
		}

		return tx.Create(&row).Error
	})
}


func (s *ChartOfAccountsService) ListAccountTypes(userID string) ([]models.CoaAccountType, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// get user's company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var rows []models.CoaAccountType

	if err := config.DB.
	Where("coa_account_type.company_id = ?", user.CompanyId).
	Preload("EncodedByUser").
	Order("coa_account_type.id ASC").
	Find(&rows).Error
	
	err != nil {
	return nil, err
}

	return rows, nil
}

func (s *ChartOfAccountsService) DeactivateAccountType(
	userID string,
	accountTypeID string,
	newName string,
	isActive bool,
) error {
	accountTypeID = strings.TrimSpace(accountTypeID)
	newName = strings.TrimSpace(newName)

	if accountTypeID == "" {
		return errors.New("accountType id is required")
	}
	if newName == "" {
		return errors.New("accountType name is required")
	}

	typeID, err := strconv.Atoi(accountTypeID)
	if err != nil {
		return errors.New("accountType id must be numeric")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	// get user to get company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()

		// Ensure account type exists under this company
		var at models.CoaAccountType
		if err := tx.Where("id = ? AND company_id = ?", typeID, user.CompanyId).First(&at).Error; err != nil {
			return errors.New("account type not found")
		}

		// Detect changes
		currentName := strings.TrimSpace(at.Type) // adjust field name if different
		nameChanged := currentName != newName
		statusChanged := at.IsActive != isActive

		// If nothing changed, do nothing
		if !nameChanged && !statusChanged {
			return errors.New("no changes made")
		}

		// Build updates only for changed fields
		parentUpdates := map[string]any{}

		if nameChanged {
			parentUpdates["type"] = newName
		}
		if statusChanged {
			parentUpdates["is_active"] = isActive
		}

		// Only update date_updated if we actually update something
		if len(parentUpdates) > 0 {
			parentUpdates["date_updated"] = now

			if err := tx.Model(&models.CoaAccountType{}).
				Where("id = ? AND company_id = ?", typeID, user.CompanyId).
				Updates(parentUpdates).Error; err != nil {
				return err
			}
		}

		// Cascade ONLY when status changed from true -> false
		if statusChanged && !isActive {
			childUpdates := map[string]any{
				"is_active":    false,
				"date_updated": now,
			}

			if err := tx.Model(&models.CoaAccountGroup{}).
				Where("company_id = ? AND account_type = ?", user.CompanyId, typeID).
				Updates(childUpdates).Error; err != nil {
				return err
			}

			if err := tx.Model(&models.CoaFsLineItem{}).
				Where("company_id = ? AND account_type = ?", user.CompanyId, typeID).
				Updates(childUpdates).Error; err != nil {
				return err
			}

			if err := tx.Model(&models.CoaNotesLineItem{}).
				Where("company_id = ? AND account_type = ?", user.CompanyId, typeID).
				Updates(childUpdates).Error; err != nil {
				return err
			}

			if err := tx.Model(&models.Coa{}).
				Where("company_id = ? AND account_type = ?", user.CompanyId, typeID).
				Updates(childUpdates).Error; err != nil {
				return err
			}
		}

		// If status changed false -> true: parent updated to true, NO child reactivation (as requested)
		return nil
	})
}





/* ================================
   ===== CREATE ACCOUNT GROUP =====
   ================================ */

func (s *ChartOfAccountsService) CreateAccountGroup(userID string, req models.CreateCoaAccountGroupRequest) error {
	req.Category = strings.TrimSpace(req.Category)
	req.ID = strings.TrimSpace(req.ID)

	if req.AccountType <= 0 {
		return errors.New("accountTypeId is required")
	}
	if req.Category == "" {
		return errors.New("category is required")
	}
	if req.ID == "" {
		return errors.New("groupNumber is required")
	}
	if _, err := strconv.Atoi(req.ID); err != nil {
		return errors.New("groupNumber must be numeric")
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
		var at models.CoaAccountType
		if err := tx.Where("id = ? AND company_id = ?", req.AccountType, user.CompanyId).First(&at).Error; err != nil {
			return errors.New("account type not found")
		}

		firstDigit := string(strconv.Itoa(req.AccountType)[0])
		if !strings.HasPrefix(req.ID, firstDigit) {
			return errors.New("groupNumber must start with " + firstDigit)
		}

		id, err := strconv.Atoi(req.ID)
		if err != nil {
			return errors.New("invalid id")
		}

		// groupNumber must not be repeated under the same company
		var cnt int64
		if err := tx.Model(&models.CoaAccountGroup{}).
			Where("company_id = ? AND id = ?", user.CompanyId, id).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking groupNumber uniqueness")
		}
		if cnt > 0 {
			return errors.New("groupNumber already exists for this company")
		}

		now := time.Now().UTC()

		row := models.CoaAccountGroup{
			ID:          id,
			Category:    req.Category,
			AccountType: req.AccountType,
			CompanyID:   user.CompanyId,
			EncodedBy:   uid,
			DateCreated: now,
			DateUpdated: now,
		}

		return tx.Create(&row).Error
	})
}



func (s *ChartOfAccountsService) ListAccountGroupsByType(userID string, accountTypeID int) ([]models.CoaAccountGroup, error) {
	if accountTypeID <= 0 {
		return nil, errors.New("accountTypeId is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// get user's company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// ensure account type exists and belongs to company
	var at models.CoaAccountType
	if err := config.DB.Where("id = ? AND company_id = ?", accountTypeID, user.CompanyId).First(&at).Error; err != nil {
		return nil, errors.New("account type not found")
	}

	var rows []models.CoaAccountGroup

	if err := config.DB.
		Where("company_id = ? AND account_type = ?", user.CompanyId, accountTypeID).
		Preload("EncodedByUser").
		Order("coa_account_group.id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) ListAccountGroups(userID string) ([]models.CoaAccountGroup, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var rows []models.CoaAccountGroup
	err = config.DB.
		Where("company_id = ?", user.CompanyId).
		Preload("EncodedByUser").
		Preload("AccountTypeObj"). // ✅ group -> type
		Order("id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) DeactivateAccountGroup(
	userID string,
	accountGroupID string,
	newName string,
	isActive bool,
) error {
	accountGroupID = strings.TrimSpace(accountGroupID)
	newName = strings.TrimSpace(newName)

	if accountGroupID == "" {
		return errors.New("accountGroup id is required")
	}
	if newName == "" {
		return errors.New("accountGroup name is required")
	}

	groupID, err := strconv.Atoi(accountGroupID)
	if err != nil {
		return errors.New("accountGroup id must be numeric")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	// get user to get company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()

		// Ensure account group exists under this company
		var ag models.CoaAccountGroup
		if err := tx.Where("id = ? AND company_id = ?", groupID, user.CompanyId).First(&ag).Error; err != nil {
			return errors.New("account group not found")
		}

		// Detect changes
		currentName := strings.TrimSpace(ag.Category) // adjust field name if different
		nameChanged := currentName != newName
		statusChanged := ag.IsActive != isActive

		// If nothing changed, do nothing
		if !nameChanged && !statusChanged {
			return errors.New("no changes made")
		}

		// Build updates only for changed fields
		parentUpdates := map[string]any{}

		if nameChanged {
			parentUpdates["category"] = newName
		}
		if statusChanged {
			parentUpdates["is_active"] = isActive
		}

		// Only update date_updated if we actually update something
		if len(parentUpdates) > 0 {
			parentUpdates["date_updated"] = now

			if err := tx.Model(&models.CoaAccountGroup{}).
				Where("id = ? AND company_id = ?", groupID, user.CompanyId).
				Updates(parentUpdates).Error; err != nil {
				return err
			}
		}

		// Cascade ONLY when status changed from true -> false
		if statusChanged && !isActive {
			childUpdates := map[string]any{
				"is_active":    false,
				"date_updated": now,
			}

			// Deactivate children that are under this account group
			if err := tx.Model(&models.CoaFsLineItem{}).
				Where("company_id = ? AND account_group = ?", user.CompanyId, groupID).
				Updates(childUpdates).Error; err != nil {
				return err
			}

			if err := tx.Model(&models.CoaNotesLineItem{}).
				Where("company_id = ? AND account_group = ?", user.CompanyId, groupID).
				Updates(childUpdates).Error; err != nil {
				return err
			}

			if err := tx.Model(&models.Coa{}).
				Where("company_id = ? AND account_group = ?", user.CompanyId, groupID).
				Updates(childUpdates).Error; err != nil {
				return err
			}
		}

		// If status changed false -> true: parent updated to true, NO child reactivation (as requested)
		return nil
	})
}




func (s *ChartOfAccountsService) CreateFSLine(userID string, req models.CreateCoaAccountFsLineItem) error {
	req.FsAccountName = strings.TrimSpace(req.FsAccountName)
	req.ID = strings.TrimSpace(req.ID)


	if req.AccountType <= 0 {
		return errors.New("accountTypeId is required")
	}

	if req.AccountGroup <= 0 {
		return errors.New("accountGroup is required")
	}

	if req.FsAccountName == "" {
		return errors.New("category is required")
	}
	if req.ID == "" {
		return errors.New("groupNumber is required")
	}
	if _, err := strconv.Atoi(req.ID); err != nil {
		return errors.New("groupNumber must be numeric")
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


		// ✅ validate using coa_account_group (account_type, company_id, category)
		var grp models.CoaAccountGroup
		if err := tx.Where(
			"account_type = ? AND company_id = ? AND id = ?",
			req.AccountType,
			user.CompanyId,
			req.AccountGroup,
		).First(&grp).Error; err != nil {
			return errors.New("account group not found")
		}

		// ✅ first-digit rule still based on account_type id
		firstDigit := string(strconv.Itoa(req.AccountType)[0])
		if !strings.HasPrefix(req.ID, firstDigit) {
			return errors.New("groupNumber must start with " + firstDigit)
		}

			id, err := strconv.Atoi(req.ID)
			if err != nil {
				return errors.New("invalid id")
			}

		var cnt int64
		if err := tx.Model(&models.CoaFsLineItem{}).
			Where("company_id = ? AND id = ?", user.CompanyId, id).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking fsline uniqueness")
		}
		if cnt > 0 {
			return errors.New("fsline number already exists for this company")
		}

		now := time.Now().UTC()

		row := models.CoaFsLineItem{
			ID:           id,
			AccountGroup:      req.AccountGroup,
			AccountType: req.AccountType,
			FsAccountName: req.FsAccountName,
			CompanyID:     user.CompanyId,
			EncodedBy:     uid,
			DateCreated:   now,
			DateUpdated:   now,
		}

		return tx.Create(&row).Error
	})
}

func (s *ChartOfAccountsService) ListFSLineItemsByTypeAndGroup(
	userID string,
	accountTypeID int,
	accountGroupID int,
) ([]models.CoaFsLineItem, error) {

	if accountTypeID <= 0 {
		return nil, errors.New("accountTypeId is required")
	}
	if accountGroupID <= 0 {
		return nil, errors.New("accountGroupId is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// get user's company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// ensure account type exists and belongs to company
	var at models.CoaAccountType
	if err := config.DB.
		Where("id = ? AND company_id = ?", accountTypeID, user.CompanyId).
		First(&at).Error; err != nil {
		return nil, errors.New("account type not found")
	}

	// ensure account group exists, belongs to company, and matches account type
	var grp models.CoaAccountGroup
	if err := config.DB.
		Where("id = ? AND company_id = ? AND account_type = ?", accountGroupID, user.CompanyId, accountTypeID).
		First(&grp).Error; err != nil {
		return nil, errors.New("account group not found")
	}

	var rows []models.CoaFsLineItem
	if err := config.DB.
		Where(
			"company_id = ? AND account_type = ? AND account_group = ?",
			user.CompanyId,
			accountTypeID,
			accountGroupID,
		).
		Order("id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) ListFSLineItems(userID string) ([]models.CoaFsLineItem, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var rows []models.CoaFsLineItem
	err = config.DB.
		Where("company_id = ?", user.CompanyId).
		Preload("EncodedByUser").
		Preload("AccountGroupObj").                 // ✅ fs -> group
		Preload("AccountGroupObj.AccountTypeObj").  // ✅ group -> type
		Order("id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) DeactivateFSLineItem(
	userID string,
	fsLineItemID string,
	newName string,
	isActive bool,
) error {
	fsLineItemID = strings.TrimSpace(fsLineItemID)
	newName = strings.TrimSpace(newName)

	if fsLineItemID == "" {
		return errors.New("fsLineItem id is required")
	}
	if newName == "" {
		return errors.New("fsLineItem name is required")
	}

	lineID, err := strconv.Atoi(fsLineItemID)
	if err != nil {
		return errors.New("fsLineItem id must be numeric")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	// get user to get company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()

		// Ensure FS line item exists under this company
		var li models.CoaFsLineItem
		if err := tx.Where("id = ? AND company_id = ?", lineID, user.CompanyId).First(&li).Error; err != nil {
			return errors.New("fs line item not found")
		}

		// Detect changes
		// NOTE: adjust field name if your struct differs
		currentName := strings.TrimSpace(li.FsAccountName)
		nameChanged := currentName != newName
		statusChanged := li.IsActive != isActive

		// If nothing changed, do nothing
		if !nameChanged && !statusChanged {
			return errors.New("no changes made")
		}

		// Build updates only for changed fields
		parentUpdates := map[string]any{}

		if nameChanged {
			// adjust column name if different
			parentUpdates["fs_account_name"] = newName
		}
		if statusChanged {
			parentUpdates["is_active"] = isActive
		}

		// Only update date_updated if we actually update something
		if len(parentUpdates) > 0 {
			parentUpdates["date_updated"] = now

			if err := tx.Model(&models.CoaFsLineItem{}).
				Where("id = ? AND company_id = ?", lineID, user.CompanyId).
				Updates(parentUpdates).Error; err != nil {
				return err
			}
		}

		// Cascade ONLY when status changed from true -> false
		if statusChanged && !isActive {
			childUpdates := map[string]any{
				"is_active":    false,
				"date_updated": now,
			}

			// Deactivate Notes Line Items under this FS line item
			// (adjust column name if yours is fs_line_item_id)
			if err := tx.Model(&models.CoaNotesLineItem{}).
				Where("company_id = ? AND fs_account = ?", user.CompanyId, lineID).
				Updates(childUpdates).Error; err != nil {
				return err
			}

			// Deactivate COA items under this FS line item
			// (adjust column name if yours is fs_line_item_id)
			if err := tx.Model(&models.Coa{}).
				Where("company_id = ? AND fs_line = ?", user.CompanyId, lineID).
				Updates(childUpdates).Error; err != nil {
				return err
			}
		}

		// If status changed false -> true: parent updated to true, NO child reactivation
		return nil
	})
}



func (s *ChartOfAccountsService) CreateNotesLine(userID string, req models.CreateCoaAccountNotesLineItem) error {
	req.NotesDescription = strings.TrimSpace(req.NotesDescription)
	req.ID = strings.TrimSpace(req.ID)


	if req.AccountType <= 0 {
		return errors.New("accountTypeId is required")
	}

	if req.AccountGroup <= 0 {
		return errors.New("accountGroup is required")
	}

		if req.FsAccount <= 0 {
		return errors.New("accountGroup is required")
	}


	if req.NotesDescription == "" {
		return errors.New("category is required")
	}
	if req.ID == "" {
		return errors.New("groupNumber is required")
	}
	if _, err := strconv.Atoi(req.ID); err != nil {
		return errors.New("groupNumber must be numeric")
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


		// ✅ validate using coa_account_group (account_type, company_id, category)
		var fs models.CoaFsLineItem
	if err := tx.Where(
		"id = ? AND company_id = ? AND account_type = ? AND account_group = ?",
		req.FsAccount,
		user.CompanyId,
		req.AccountType,
		req.AccountGroup,
	).First(&fs).Error; err != nil {
		return errors.New("fs line item not found")
}

		// ✅ first-digit rule still based on account_type id
		firstDigit := string(strconv.Itoa(req.AccountType)[0])
		if !strings.HasPrefix(req.ID, firstDigit) {
			return errors.New("groupNumber must start with " + firstDigit)
		}

			id, err := strconv.Atoi(req.ID)
			if err != nil {
				return errors.New("invalid id")
			}

		var cnt int64
		if err := tx.Model(&models.CoaNotesLineItem{}).
			Where("company_id = ? AND id = ?", user.CompanyId, id).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking notesline uniqueness")
		}
		if cnt > 0 {
			return errors.New("notes line number already exists for this company")
		}

		now := time.Now().UTC()

		row := models.CoaNotesLineItem{
			ID:           id,
			AccountGroup:      req.AccountGroup,
			AccountType: req.AccountType,
			FsAccount: req.FsAccount,
			CompanyID:     user.CompanyId,
			NotesDescription: req.NotesDescription,
			EncodedBy:     uid,
			DateCreated:   now,
			DateUpdated:   now,
		}

		return tx.Create(&row).Error
	})
}


func (s *ChartOfAccountsService) ListNotesLineItemsByTypeGroupAndFSLine(
	userID string,
	accountTypeID int,
	accountGroupID int,
	FsAccount int,
) ([]models.CoaNotesLineItem, error) {

	if accountTypeID <= 0 {
		return nil, errors.New("accountTypeId is required")
	}
	if accountGroupID <= 0 {
		return nil, errors.New("accountGroupId is required")
	}
	if FsAccount <= 0 {
		return nil, errors.New("fsLineItemId is required")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// get user's company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// ensure account type exists and belongs to company
	var at models.CoaAccountType
	if err := config.DB.
		Where("id = ? AND company_id = ?", accountTypeID, user.CompanyId).
		First(&at).Error; err != nil {
		return nil, errors.New("account type not found")
	}

	// ensure account group exists, belongs to company, and matches account type
	var grp models.CoaAccountGroup
	if err := config.DB.
		Where("id = ? AND company_id = ? AND account_type = ?", accountGroupID, user.CompanyId, accountTypeID).
		First(&grp).Error; err != nil {
		return nil, errors.New("account group not found")
	}

	// ensure fs line item exists, belongs to company, and matches (type + group)
	var fs models.CoaFsLineItem
	if err := config.DB.
		Where(
			"id = ? AND company_id = ? AND account_type = ? AND account_group = ?",
			FsAccount,
			user.CompanyId,
			accountTypeID,
			accountGroupID,
		).
		First(&fs).Error; err != nil {
		return nil, errors.New("fs line item not found")
	}

	// finally list notes line items under this hierarchy
	var rows []models.CoaNotesLineItem
	if err := config.DB.
		Where(
			"company_id = ? AND account_type = ? AND account_group = ? AND fs_account = ?",
			user.CompanyId,
			accountTypeID,
			accountGroupID,
			FsAccount,
		).
		Order("id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) ListNotesLineItems(userID string) ([]models.CoaNotesLineItem, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var rows []models.CoaNotesLineItem
	err = config.DB.
		Where("company_id = ?", user.CompanyId).
		Preload("EncodedByUser").
		Preload("FsAccountObj"). // Notes -> FS
		Preload("FsAccountObj.AccountGroupObj"). // FS -> Group
		Preload("FsAccountObj.AccountGroupObj.AccountTypeObj"). // Group -> Type
		Order("id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) DeactivateNotesLineItem(
	userID string,
	notesLineItemID string,
	newName string,
	isActive bool,
) error {
	notesLineItemID = strings.TrimSpace(notesLineItemID)
	newName = strings.TrimSpace(newName)

	if notesLineItemID == "" {
		return errors.New("notesLineItem id is required")
	}
	if newName == "" {
		return errors.New("notesLineItem name is required")
	}

	lineID, err := strconv.Atoi(notesLineItemID)
	if err != nil {
		return errors.New("notesLineItem id must be numeric")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	// get user to get company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()

		// Ensure Notes line item exists under this company
		var nli models.CoaNotesLineItem
		if err := tx.Where("id = ? AND company_id = ?", lineID, user.CompanyId).First(&nli).Error; err != nil {
			return errors.New("notes line item not found")
		}

		// Detect changes
		// NOTE: adjust field name if your struct differs
		currentName := strings.TrimSpace(nli.NotesDescription)
		nameChanged := currentName != newName
		statusChanged := nli.IsActive != isActive

		// If nothing changed, do nothing
		if !nameChanged && !statusChanged {
			return errors.New("no changes made")
		}

		// Build updates only for changed fields
		parentUpdates := map[string]any{}

		if nameChanged {
			// adjust column name if different
			parentUpdates["notes_description"] = newName
		}
		if statusChanged {
			parentUpdates["is_active"] = isActive
		}

		// Only update date_updated if we actually update something
		if len(parentUpdates) > 0 {
			parentUpdates["date_updated"] = now

			if err := tx.Model(&models.CoaNotesLineItem{}).
				Where("id = ? AND company_id = ?", lineID, user.CompanyId).
				Updates(parentUpdates).Error; err != nil {
				return err
			}
		}

		// Cascade ONLY when status changed from true -> false
		if statusChanged && !isActive {
			childUpdates := map[string]any{
				"is_active":    false,
				"date_updated": now,
			}

			// Deactivate COA items under this Notes line item
			// (adjust column name if yours is notes_line_item_id)
			if err := tx.Model(&models.Coa{}).
				Where("company_id = ? AND notes_line = ?", user.CompanyId, lineID).
				Updates(childUpdates).Error; err != nil {
				return err
			}
		}

		// If status changed false -> true: parent updated to true, NO child reactivation
		return nil
	})
}



func (s *ChartOfAccountsService) CreateCoa(userID string, req models.CreateCoaRequest) error {
	req.ID = strings.TrimSpace(req.ID)
	req.AccountDescription = strings.TrimSpace(req.AccountDescription)
	req.AccountLongDesc = strings.TrimSpace(req.AccountLongDesc)

	// basic required validations
	if req.AccountType <= 0 {
		return errors.New("accountType is required")
	}
	if req.AccountGroup <= 0 {
		return errors.New("accountGroup is required")
	}
	if req.FsLine <= 0 {
		return errors.New("fsLine is required")
	}
	if req.NotesLine <= 0 {
		return errors.New("notesLine is required")
	}
	if req.ID == "" {
		return errors.New("coa id is required")
	}
	if _, err := strconv.Atoi(req.ID); err != nil {
		return errors.New("coa id must be numeric")
	}
	if req.AccountDescription == "" {
		return errors.New("account description is required")
	}

	// first-digit rule (same pattern you used)
	firstDigit := string(strconv.Itoa(req.AccountType)[0])
	if !strings.HasPrefix(req.ID, firstDigit) {
		return errors.New("coa id must start with " + firstDigit)
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
		// 1) Validate account group exists under this company + account type
		var grp models.CoaAccountGroup
		if err := tx.Where(
			"id = ? AND company_id = ? AND account_type = ?",
			req.AccountGroup,
			user.CompanyId,
			req.AccountType,
		).First(&grp).Error; err != nil {
			return errors.New("account group not found")
		}

		// 2) Validate fs line exists under this company + type + group
		var fs models.CoaFsLineItem
		if err := tx.Where(
			"id = ? AND company_id = ? AND account_type = ? AND account_group = ?",
			req.FsLine,
			user.CompanyId,
			req.AccountType,
			req.AccountGroup,
		).First(&fs).Error; err != nil {
			return errors.New("fs line item not found")
		}

		// 3) Validate notes line exists under this company + type + group + fs line
		var notes models.CoaNotesLineItem
		if err := tx.Where(
			"id = ? AND company_id = ? AND account_type = ? AND account_group = ? AND fs_account = ?",
			req.NotesLine,
			user.CompanyId,
			req.AccountType,
			req.AccountGroup,
			req.FsLine,
		).First(&notes).Error; err != nil {
			return errors.New("notes line item not found")
		}

		// 4) Convert COA id string -> int
		idInt, err := strconv.Atoi(req.ID)
		if err != nil {
			return errors.New("invalid coa id")
		}

		var cnt int64
		if err := tx.Model(&models.Coa{}).
			Where("company_id = ? AND id = ?", user.CompanyId, idInt).
			Count(&cnt).Error; err != nil {
			return errors.New("failed checking coa id uniqueness")
		}
		if cnt > 0 {
			return errors.New("coa id already exists")
		}
		now := time.Now().UTC()

		row := models.Coa{
			ID:                 idInt,
			AccountType:         req.AccountType,
			AccountGroup:        req.AccountGroup,
			FsLine:              req.FsLine,
			NotesLine:           req.NotesLine,
			AccountDescription:  req.AccountDescription,
			AccountLongDesc:     req.AccountLongDesc, // optional ok
			CompanyID:           user.CompanyId,
			EncodedBy:           uid,
			DateCreated:         now,
			DateUpdated:         now,
		}

		return tx.Create(&row).Error
	})
}

func (s *ChartOfAccountsService) ListCoa(userID string) ([]models.Coa, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var rows []models.Coa
	err = config.DB.
		Where("company_id = ?", user.CompanyId).
		Preload("EncodedByUser").
		Preload("NotesLineObj").                                              // ✅ coa -> notes
		Preload("NotesLineObj.FsAccountObj").                                  // ✅ notes -> fs
		Preload("NotesLineObj.FsAccountObj.AccountGroupObj").                  // ✅ fs -> group
		Preload("NotesLineObj.FsAccountObj.AccountGroupObj.AccountTypeObj").   // ✅ group -> type
		Order("id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}

	return rows, nil
}

func (s *ChartOfAccountsService) DeactivateCoaItem(
	userID string,
	coaID string,
	newAccountDescription string,
	newAccountLongDesc string,
	isActive bool,
) error {
	coaID = strings.TrimSpace(coaID)
	newAccountDescription = strings.TrimSpace(newAccountDescription)
	newAccountLongDesc = strings.TrimSpace(newAccountLongDesc)

	if coaID == "" {
		return errors.New("coa id is required")
	}
	if newAccountDescription == "" {
		return errors.New("account description is required")
	}

	id, err := strconv.Atoi(coaID)
	if err != nil {
		return errors.New("coa id must be numeric")
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return errors.New("invalid user id")
	}

	// get user to get company_id
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return errors.New("user not found")
	}

	return config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now().UTC()

		// Ensure COA item exists under this company
		var coa models.Coa
		if err := tx.Where("id = ? AND company_id = ?", id, user.CompanyId).First(&coa).Error; err != nil {
			return errors.New("coa item not found")
		}

		// Detect changes
		currentDesc := strings.TrimSpace(coa.AccountDescription)
		currentLong := strings.TrimSpace(coa.AccountLongDesc)

		descChanged := currentDesc != newAccountDescription
		longChanged := currentLong != newAccountLongDesc
		statusChanged := coa.IsActive != isActive

		// If nothing changed, do nothing
		if !descChanged && !longChanged && !statusChanged {
			return errors.New("no changes made")
		}

		// Build updates only for changed fields
		updates := map[string]any{}

		if descChanged {
			// adjust column name if different
			updates["account_description"] = newAccountDescription
		}
		if longChanged {
			// adjust column name if different
			updates["account_long_desc"] = newAccountLongDesc
		}
		if statusChanged {
			updates["is_active"] = isActive
		}

		// Only update date_updated if we actually update something
		if len(updates) > 0 {
			updates["date_updated"] = now

			if err := tx.Model(&models.Coa{}).
				Where("id = ? AND company_id = ?", id, user.CompanyId).
				Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
}



type ImportRowError struct {
	Row     int    `json:"row"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

type ImportCounts struct {
	AccountTypes   int `json:"accountTypes"`
	AccountGroups  int `json:"accountGroups"`
	FSLineItems    int `json:"fsLineItems"`
	NotesLineItems int `json:"notesLineItems"`
	CoaItems       int `json:"coaItems"`
}

type ImportResult struct {
	Message string           `json:"message"`
	Counts  ImportCounts     `json:"counts"`
	Errors  []ImportRowError `json:"errors,omitempty"`
}

var coaTemplateHeaders = []string{
	"Account Type ID",
	"Account Type Description",
	"Account Group ID",
	"Category Name",
	"FS Line ID",
	"FS Line Account Name",
	"Notes Line ID",
	"Notes Line Description",
	"COA ID",
	"COA Item Name",
	"Description",
}

func (s *ChartOfAccountsService) ImportCoaFromExcel(userID string, r io.Reader) (*ImportResult, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	// get user -> company_id (matches your pattern)
	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// read entire file
	b, err := io.ReadAll(r)
	if err != nil {
		return nil, errors.New("failed to read file")
	}

	xl, err := excelize.OpenReader(bytes.NewReader(b))
	if err != nil {
		return nil, errors.New("invalid excel file (must be .xlsx)")
	}
	defer func() { _ = xl.Close() }()

	sheets := xl.GetSheetList()
	if len(sheets) == 0 {
		return nil, errors.New("excel has no sheets")
	}
	sheet := sheets[0]

	rows, err := xl.GetRows(sheet)
	if err != nil {
		return nil, errors.New("failed to read sheet")
	}

	// must have header rows
	if len(rows) < 2 {
		return nil, errors.New("template is invalid (missing header rows)")
	}

	// Validate row 2 headers (index 1)
	h := normalizeRowLen(rows[1], len(coaTemplateHeaders))
	for i := range coaTemplateHeaders {
		if strings.TrimSpace(h[i]) != coaTemplateHeaders[i] {
			return nil, fmt.Errorf(
				"template header mismatch at column %d: expected '%s'",
				i+1,
				coaTemplateHeaders[i],
			)
		}
	}

	res := &ImportResult{
		Counts: ImportCounts{},
		Errors: []ImportRowError{},
	}

	now := time.Now().UTC()

	// caches to reduce DB reads
	typeSeen := map[string]bool{}
	groupSeen := map[string]bool{}
	fsSeen := map[string]bool{}
	notesSeen := map[string]bool{}
	coaSeen := map[string]bool{}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		// Data starts at row 3 => index 2
		for i := 2; i < len(rows); i++ {
			rowNum := i + 1 // excel row number
			row := normalizeRowLen(rows[i], len(coaTemplateHeaders))

			if isAllEmpty(row) {
				continue
			}

			// Columns
			atIDStr := strings.TrimSpace(row[0])
			atDesc := strings.TrimSpace(row[1])

			agIDStr := strings.TrimSpace(row[2])
			agName := strings.TrimSpace(row[3])

			fsIDStr := strings.TrimSpace(row[4])
			fsName := strings.TrimSpace(row[5])

			notesIDStr := strings.TrimSpace(row[6])
			notesDesc := strings.TrimSpace(row[7])

			coaIDStr := strings.TrimSpace(row[8])
			coaName := strings.TrimSpace(row[9])
			coaLong := strings.TrimSpace(row[10]) // optional

			// Required fields
			if atIDStr == "" || atDesc == "" {
				res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "Account Type", Message: "Account Type ID and Description are required"})
				continue
			}
			if agIDStr == "" || agName == "" {
				res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "Account Group", Message: "Account Group ID and Category Name are required"})
				continue
			}
			if fsIDStr == "" || fsName == "" {
				res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "FS Line Item", Message: "FS Line ID and FS Line Account Name are required"})
				continue
			}
			if notesIDStr == "" || notesDesc == "" {
				res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "Notes Line Item", Message: "Notes Line ID and Notes Line Description are required"})
				continue
			}
			if coaIDStr == "" || coaName == "" {
				res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "COA", Message: "COA ID and COA Item Name are required"})
				continue
			}

			// Parse numeric IDs
			atID, e1 := atoiStrict(atIDStr)
			agID, e2 := atoiStrict(agIDStr)
			fsID, e3 := atoiStrict(fsIDStr)
			notesID, e4 := atoiStrict(notesIDStr)
			coaID, e5 := atoiStrict(coaIDStr)
			if e1 != nil || e2 != nil || e3 != nil || e4 != nil || e5 != nil {
				res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Message: "All ID columns must be numeric"})
				continue
			}

			// First digit rule: everything starts with account type first digit
			firstDigit := string(strconv.Itoa(atID)[0])
			if !strings.HasPrefix(strconv.Itoa(agID), firstDigit) ||
				!strings.HasPrefix(strconv.Itoa(fsID), firstDigit) ||
				!strings.HasPrefix(strconv.Itoa(notesID), firstDigit) ||
				!strings.HasPrefix(strconv.Itoa(coaID), firstDigit) {
				res.Errors = append(res.Errors, ImportRowError{
					Row:     rowNum,
					Message: "ID rule failed: Group/FS/Notes/COA IDs must start with the first digit of Account Type ID",
				})
				continue
			}

			companyKey := user.CompanyId.String()

			// 1) Account Type (unique per company + id)
			typeKey := fmt.Sprintf("%s|%d", companyKey, atID)
			if !typeSeen[typeKey] {
				var ex models.CoaAccountType
				err := tx.Where("company_id = ? AND id = ?", user.CompanyId, atID).First(&ex).Error
				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						newRow := models.CoaAccountType{
							ID:          atID,
							Type:        atDesc,
							CompanyID:   user.CompanyId,
							EncodedBy:   uid,
							DateCreated: now,
							DateUpdated: now,
						}
						if err := tx.Create(&newRow).Error; err != nil {
							res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "Account Type", Message: err.Error()})
							continue
						}
						res.Counts.AccountTypes++
					} else {
						return err
					}
				}
				typeSeen[typeKey] = true
			}

			// 2) Account Group (company + account_type + id)
			groupKey := fmt.Sprintf("%s|%d|%d", companyKey, atID, agID)
			if !groupSeen[groupKey] {
				var ex models.CoaAccountGroup
				err := tx.Where("company_id = ? AND account_type = ? AND id = ?", user.CompanyId, atID, agID).First(&ex).Error
				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						newRow := models.CoaAccountGroup{
							ID:          agID,
							AccountType: atID,
							Category:    agName,
							CompanyID:   user.CompanyId,
							EncodedBy:   uid,
							DateCreated: now,
							DateUpdated: now,
						}
						if err := tx.Create(&newRow).Error; err != nil {
							res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "Account Group", Message: err.Error()})
							continue
						}
						res.Counts.AccountGroups++
					} else {
						return err
					}
				}
				groupSeen[groupKey] = true
			}

			// 3) FS Line Item (company + type + group + id)
			fsKey := fmt.Sprintf("%s|%d|%d|%d", companyKey, atID, agID, fsID)
			if !fsSeen[fsKey] {
				var ex models.CoaFsLineItem
				err := tx.Where(
					"company_id = ? AND account_type = ? AND account_group = ? AND id = ?",
					user.CompanyId, atID, agID, fsID,
				).First(&ex).Error
				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						newRow := models.CoaFsLineItem{
							ID:            fsID,
							AccountType:    atID,
							AccountGroup:   agID,
							FsAccountName:  fsName,
							CompanyID:      user.CompanyId,
							EncodedBy:      uid,
							DateCreated:    now,
							DateUpdated:    now,
						}
						if err := tx.Create(&newRow).Error; err != nil {
							res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "FS Line Item", Message: err.Error()})
							continue
						}
						res.Counts.FSLineItems++
					} else {
						return err
					}
				}
				fsSeen[fsKey] = true
			}

			// 4) Notes Line Item (company + type + group + fs + id)
			notesKey := fmt.Sprintf("%s|%d|%d|%d|%d", companyKey, atID, agID, fsID, notesID)
			if !notesSeen[notesKey] {
				var ex models.CoaNotesLineItem
				err := tx.Where(
					"company_id = ? AND account_type = ? AND account_group = ? AND fs_account = ? AND id = ?",
					user.CompanyId, atID, agID, fsID, notesID,
				).First(&ex).Error
				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						newRow := models.CoaNotesLineItem{
							ID:               notesID,
							AccountType:       atID,
							AccountGroup:      agID,
							FsAccount:         fsID,
							NotesDescription:  notesDesc,
							CompanyID:         user.CompanyId,
							EncodedBy:         uid,
							DateCreated:       now,
							DateUpdated:       now,
						}
						if err := tx.Create(&newRow).Error; err != nil {
							res.Errors = append(res.Errors, ImportRowError{Row: rowNum, Field: "Notes Line Item", Message: err.Error()})
							continue
						}
						res.Counts.NotesLineItems++
					} else {
						return err
					}
				}
				notesSeen[notesKey] = true
			}

			// 5) COA (company + id)
			coaKey := fmt.Sprintf("%s|%d", companyKey, coaID)
			if !coaSeen[coaKey] {
				var ex models.Coa
				err := tx.Where("company_id = ? AND id = ?", user.CompanyId, coaID).First(&ex).Error

				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						// Not found => create
						newRow := models.Coa{
							ID:                coaID,
							AccountType:        atID,
							AccountGroup:       agID,
							FsLine:             fsID,
							NotesLine:          notesID,
							AccountDescription: coaName,
							AccountLongDesc:    coaLong, // optional
							CompanyID:          user.CompanyId,
							EncodedBy:          uid,
							DateCreated:        now,
							DateUpdated:        now,
						}

						if err := tx.Create(&newRow).Error; err != nil {
							res.Errors = append(res.Errors, ImportRowError{
								Row: rowNum, Field: "COA", Message: err.Error(),
							})
							continue
						}
						res.Counts.CoaItems++
					} else {
						// Real DB error => stop
						return err
					}
				} else {
					// Found => treat as import conflict
					res.Errors = append(res.Errors, ImportRowError{
						Row: rowNum, Field: "COA", Message: "COA ID already exists",
					})
					continue
				}

				coaSeen[coaKey] = true
			}


		}

		if len(res.Errors) > 0 {
			return errors.New("import failed: please fix the errors and upload again")
		}
		return nil
	})

	if err != nil {
		return res, err
	}

	res.Message = fmt.Sprintf(
		"Imported successfully: %d account types, %d groups, %d FS lines, %d notes lines, %d COA items",
		res.Counts.AccountTypes,
		res.Counts.AccountGroups,
		res.Counts.FSLineItems,
		res.Counts.NotesLineItems,
		res.Counts.CoaItems,
	)

	return res, nil
}

func normalizeRowLen(r []string, n int) []string {
	out := make([]string, n)
	for i := 0; i < n; i++ {
		if i < len(r) {
			out[i] = r[i]
		} else {
			out[i] = ""
		}
	}
	return out
}

func isAllEmpty(r []string) bool {
	for _, v := range r {
		if strings.TrimSpace(v) != "" {
			return false
		}
	}
	return true
}

func atoiStrict(s string) (int, error) {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", ""))
	if s == "" {
		return 0, errors.New("empty")
	}
	return strconv.Atoi(s)
}