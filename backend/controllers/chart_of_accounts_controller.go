package controllers

import (
	"backend/models"
	"backend/services"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

type ChartOfAccountsController struct {
	coaService *services.ChartOfAccountsService
}

func 	NewChartOfAccountsController() *ChartOfAccountsController {
	return &ChartOfAccountsController{
		coaService: services.NewChartOfAccountsService(),
	}
}

func (cc *ChartOfAccountsController) CreateAccountType(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateCoaAccountTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.CreateAccountType(userID, req.AccountType); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// frontend just needs alert("success")
	c.Status(http.StatusCreated)
}



func (cc *ChartOfAccountsController) ListAccountTypes(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	rows, err := cc.coaService.ListAccountTypes(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// returns: [{id, type, ...}]
	c.JSON(http.StatusOK, rows)
}

func (cc *ChartOfAccountsController) DeactivateAccountType(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	accountTypeID := strings.TrimSpace(c.Param("id"))
	if accountTypeID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountType id is required"})
		return
	}

	// payload from frontend: { type, isActive }
	var req struct {
		Type     string `json:"type"`
		IsActive bool   `json:"isActive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

if err := cc.coaService.DeactivateAccountType(userID, accountTypeID, req.Type, req.IsActive); err != nil {
    if err.Error() == "no changes made" {
        c.JSON(http.StatusOK, gin.H{"message": "no changes made"})
        return
    }
    c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
    return
}

c.JSON(http.StatusOK, gin.H{"message": "updated"})
}




func (cc *ChartOfAccountsController) CreateAccountGroup(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateCoaAccountGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.CreateAccountGroup(userID, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusCreated)
}


func (cc *ChartOfAccountsController) ListAccountCategories(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Optional filter
	accountTypeIDStr := strings.TrimSpace(c.Query("accountTypeId"))

	// ✅ If no accountTypeId, return ALL
	if accountTypeIDStr == "" {
		rows, err := cc.coaService.ListAccountGroups(userID) // <-- your "all" service
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, rows)
		return
	}

	// ✅ If accountTypeId is provided, validate and filter
	accountTypeID, err := strconv.Atoi(accountTypeIDStr)
	if err != nil || accountTypeID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountTypeId must be a positive number"})
		return
	}

	rows, err := cc.coaService.ListAccountGroupsByType(userID, accountTypeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

func (cc *ChartOfAccountsController) DeactivateAccountGroup(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	accountGroupID := strings.TrimSpace(c.Param("id"))
	if accountGroupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountGroup id is required"})
		return
	}

	// payload from frontend: { group, isActive }
	var req struct {
		Group    string `json:"group"`
		IsActive bool   `json:"isActive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.DeactivateAccountGroup(userID, accountGroupID, req.Group, req.IsActive); err != nil {
		if err.Error() == "no changes made" {
			c.JSON(http.StatusOK, gin.H{"message": "no changes made"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}



func (cc *ChartOfAccountsController) CreateFSLine(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateCoaAccountFsLineItem
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.CreateFSLine(userID, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusCreated)
}


func (cc *ChartOfAccountsController) ListFSLineItems(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Optional filters
	accountTypeIDStr := strings.TrimSpace(c.Query("accountTypeId"))
	accountGroupIDStr := strings.TrimSpace(c.Query("accountGroupId"))

	// ✅ Case 1: no filters -> return ALL (company scope)
	if accountTypeIDStr == "" && accountGroupIDStr == "" {
		fmt.Println("test");
		rows, err := cc.coaService.ListFSLineItems(userID) // new "all" service
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, rows)
		return
	}

	// ✅ Only allow both filters together
	if accountTypeIDStr == "" || accountGroupIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountTypeId and accountGroupId must be provided together"})
		return
	}

	// ✅ Case 2: both filters provided -> validate + filter
	accountTypeID, err := strconv.Atoi(accountTypeIDStr)
	if err != nil || accountTypeID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountTypeId must be a positive number"})
		return
	}

	accountGroupID, err := strconv.Atoi(accountGroupIDStr)
	if err != nil || accountGroupID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountGroupId must be a positive number"})
		return
	}

	rows, err := cc.coaService.ListFSLineItemsByTypeAndGroup(userID, accountTypeID, accountGroupID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

func (cc *ChartOfAccountsController) DeactivateFSLineItem(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	fsLineItemID := strings.TrimSpace(c.Param("id"))
	if fsLineItemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fsLineItem id is required"})
		return
	}

	// payload from frontend: { lineItem, isActive }
	var req struct {
		LineItem string `json:"lineItem"`
		IsActive bool   `json:"isActive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.DeactivateFSLineItem(userID, fsLineItemID, req.LineItem, req.IsActive); err != nil {
		if err.Error() == "no changes made" {
			c.JSON(http.StatusOK, gin.H{"message": "no changes made"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}


func (cc *ChartOfAccountsController) CreateNotesLine(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateCoaAccountNotesLineItem
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.CreateNotesLine(userID, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusCreated)
}

func (cc *ChartOfAccountsController) ListNotesLineItems(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Optional filters (same pattern as ListFSLineItems)
	accountTypeIDStr := strings.TrimSpace(c.Query("accountTypeId"))
	accountGroupIDStr := strings.TrimSpace(c.Query("accountGroupId"))
	fsAccountStr := strings.TrimSpace(c.Query("fsAccount"))

	// ✅ Case 1: no filters -> return ALL (company scope)
	if accountTypeIDStr == "" && accountGroupIDStr == "" && fsAccountStr == "" {
		rows, err := cc.coaService.ListNotesLineItems(userID) // "all" service (company scope)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, rows)
		return
	}

	// ✅ Only allow all 3 filters together
	if accountTypeIDStr == "" || accountGroupIDStr == "" || fsAccountStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "accountTypeId, accountGroupId, and fsAccount must be provided together",
		})
		return
	}

	// ✅ Case 2: all filters provided -> validate + filter
	accountTypeID, err := strconv.Atoi(accountTypeIDStr)
	if err != nil || accountTypeID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountTypeId must be a positive number"})
		return
	}

	accountGroupID, err := strconv.Atoi(accountGroupIDStr)
	if err != nil || accountGroupID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "accountGroupId must be a positive number"})
		return
	}

	fsLineItemID, err := strconv.Atoi(fsAccountStr)
	if err != nil || fsLineItemID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fsAccount must be a positive number"})
		return
	}

	rows, err := cc.coaService.ListNotesLineItemsByTypeGroupAndFSLine(userID, accountTypeID, accountGroupID, fsLineItemID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}


func (cc *ChartOfAccountsController) DeactivateNotesLineItem(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	notesLineItemID := strings.TrimSpace(c.Param("id"))
	if notesLineItemID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "notesLineItem id is required"})
		return
	}

	// payload from frontend: { lineItem, isActive }
	var req struct {
		LineItem string `json:"lineItem"`
		IsActive bool   `json:"isActive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.DeactivateNotesLineItem(userID, notesLineItemID, req.LineItem, req.IsActive); err != nil {
		if err.Error() == "no changes made" {
			c.JSON(http.StatusOK, gin.H{"message": "no changes made"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}


func (cc *ChartOfAccountsController) ListCoa(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	rows, err := cc.coaService.ListCoa(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}



func (cc *ChartOfAccountsController) CreateCoa(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateCoaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// helpful: return actual error during dev
		// c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.CreateCoa(userID, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusCreated)
}

func (cc *ChartOfAccountsController) DeactivateCoaItem(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	coaID := strings.TrimSpace(c.Param("id"))
	if coaID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "coa id is required"})
		return
	}

	// payload from frontend:
	// { accountDescription, accountLongDesc, isActive }
	var req struct {
		AccountDescription string `json:"accountDescription"`
		AccountLongDesc    string `json:"accountLongDesc"`
		IsActive           bool   `json:"isActive"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := cc.coaService.DeactivateCoaItem(
		userID,
		coaID,
		req.AccountDescription,
		req.AccountLongDesc,
		req.IsActive,
	); err != nil {
		if err.Error() == "no changes made" {
			c.JSON(http.StatusOK, gin.H{"message": "no changes made"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}




func (cc *ChartOfAccountsController) DownloadCoaTemplate(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists || userIDVal == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	path := "templates/COA_TEMPLATE.xlsx" // relative to your server working dir

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", "attachment; filename=COA_TEMPLATE.xlsx")
	c.File(path)
}




func (cc *ChartOfAccountsController) ImportCoaExcel(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}

	fh, err := file.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to open file"})
		return
	}
	defer fh.Close()

	result, err := cc.coaService.ImportCoaFromExcel(userID, fh)
	if err != nil {
		// if we have row errors, return them too
		if result != nil && len(result.Errors) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":  err.Error(),
				"errors": result.Errors,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": result.Message,
		"counts":  result.Counts,
	})
}
