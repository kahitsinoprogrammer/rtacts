package controllers

import (
	"backend/models"
	"backend/services"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type CompanySettingsController struct {
	companySettingsService *services.CompanySettingsService
}

func NewCompanySettingsController() *CompanySettingsController {
	return &CompanySettingsController{
		companySettingsService: services.NewCompanySettingsService(),
	}
}

func (cc *CompanySettingsController) GetCompanySettings(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	settings, err := cc.companySettingsService.GetCompanySettings(userID)
	if err != nil {
		cc.handleCompanySettingsError(c, err)
		return
	}

	c.JSON(http.StatusOK, settings)
}

func (cc *CompanySettingsController) UpdateCompanySettings(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.UpdateCompanySettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	settings, err := cc.companySettingsService.UpdateCompanySettings(userID, req)
	if err != nil {
		cc.handleCompanySettingsError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "company settings updated",
		"data":    settings,
	})
}

func (cc *CompanySettingsController) handleCompanySettingsError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrCompanySettingsForbidden):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
	}
}

func getAuthenticatedUserID(c *gin.Context) (string, bool) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		return "", false
	}

	userID, ok := userIDVal.(string)
	if !ok || userID == "" {
		return "", false
	}

	return userID, true
}
