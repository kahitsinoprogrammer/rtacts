package controllers

import (
	"backend/models"
	"backend/services"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type InvoiceController struct {
	invoiceService *services.InvoiceService
}

func NewInvoiceController() *InvoiceController {
	return &InvoiceController{
		invoiceService: services.NewInvoiceService(),
	}
}

func (ic *InvoiceController) GetCreateLookups(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	lookups, err := ic.invoiceService.GetCreateLookups(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, lookups)
}

func (ic *InvoiceController) CreateInvoice(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreateInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	invoice, err := ic.invoiceService.CreateInvoice(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoice)
}

func (ic *InvoiceController) PreviewInvoice(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.PreviewInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	preview, err := ic.invoiceService.PreviewInvoice(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, preview)
}

func (ic *InvoiceController) UpdateInvoiceStatus(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	invoiceID := strings.TrimSpace(c.Param("id"))
	if invoiceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invoice id is required"})
		return
	}

	var req models.UpdateInvoiceStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := ic.invoiceService.UpdateInvoiceStatus(userID, invoiceID, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (ic *InvoiceController) ViewInvoices(c *gin.Context) {
	userID, ok := getAuthenticatedUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	invoices, err := ic.invoiceService.ViewInvoices(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invoices)
}
