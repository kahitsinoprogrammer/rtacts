package routes

import (
	"backend/controllers"

	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	accountController := controllers.NewAccountController()
	companySettingsController := controllers.NewCompanySettingsController()
	coaController := controllers.NewChartOfAccountsController()
	supplierController := controllers.NewSupplierController()
	customerController := controllers.NewCustomerController()
	cvController := controllers.NewCVController()
	inventoryController := controllers.NewInventoryController()
	r.POST("/accounts", accountController.CreateAccount)
	r.POST("/accounts/login", accountController.Login)

	protected := r.Group("/")
	protected.Use(accountController.AuthMiddleware())
	{
		protected.GET("/accounts", accountController.ViewAccounts)
		protected.PUT("/accounts/:id", accountController.UpdateAccount)
		protected.GET("/accounts/me", accountController.Me)
		protected.POST("/accounts/logout", accountController.Logout)
		protected.GET("/settings/company", companySettingsController.GetCompanySettings)
		protected.PUT("/settings/company", companySettingsController.UpdateCompanySettings)
		coa := protected.Group("/chart-of-accounts")
		{
			coa.POST("/account-types", coaController.CreateAccountType)
			coa.GET("/account-types", coaController.ListAccountTypes)
			coa.POST("/account-groups", coaController.CreateAccountGroup)
			coa.GET("/account-categories", coaController.ListAccountCategories)
			coa.POST("/fs-lines", coaController.CreateFSLine)
			coa.GET("/fs-line-items", coaController.ListFSLineItems)
			coa.POST("/notes-line-items", coaController.CreateNotesLine)
			coa.GET("/notes-line-items", coaController.ListNotesLineItems)
			coa.POST("/coa-items", coaController.CreateCoa)
			coa.GET("/coa-items", coaController.ListCoa)
			coa.GET("/coa-template", coaController.DownloadCoaTemplate)
			coa.POST("/import-coa", coaController.ImportCoaExcel)

			// ✅ Deactivate Account Type (cascade)
			coa.PATCH("/account-types/:id/deactivate", coaController.DeactivateAccountType)
			coa.PATCH("/account-groups/:id/deactivate", coaController.DeactivateAccountGroup)
			coa.PATCH("/fs-line-items/:id/deactivate", coaController.DeactivateFSLineItem)
			coa.PATCH("/notes-line-items/:id/deactivate", coaController.DeactivateNotesLineItem)
			coa.PATCH("/coa-items/:id/deactivate", coaController.DeactivateCoaItem)

		}

		suppliers := protected.Group("/suppliers")
		{
			suppliers.POST("", supplierController.CreateSupplier)
			suppliers.GET("", supplierController.ViewSupplier)
			suppliers.PUT("/:id", supplierController.UpdateSupplier)

			// later:
			// suppliers.GET("", supplierController.ListSuppliers)
			// suppliers.GET("/:id", supplierController.GetSupplier)
			// suppliers.PATCH("/:id/deactivate", supplierController.DeactivateSupplier)
		}

		customer := protected.Group("/customers")
		{
			customer.POST("", customerController.CreateCustomer)
			customer.GET("", customerController.ViewCustomer)
			customer.PUT("/:id", customerController.UpdateCustomer)

			// later:
			// suppliers.GET("", supplierController.ListSuppliers)
			// suppliers.GET("/:id", supplierController.GetSupplier)
			// suppliers.PATCH("/:id/deactivate", supplierController.DeactivateSupplier)
		}

		checkVouchers := protected.Group("/check-vouchers")
		{
			checkVouchers.GET("/lookups", cvController.GetCreateLookups)
			checkVouchers.POST("", cvController.CreateCheckVoucher)
			checkVouchers.GET("", cvController.ViewCheckVouchers)
			checkVouchers.PATCH("/:id/status", cvController.UpdateCheckVoucherStatus)

			// later:
			// checkVouchers.GET("", cvController.ViewCheckVouchers)
			// checkVouchers.PUT("/:id", cvController.UpdateCheckVoucher)
			// checkVouchers.PATCH("/:id/deactivate", cvController.DeactivateCheckVoucher)
		}

		inventory := protected.Group("/inventories")
		{
			inventory.GET("/lookups", inventoryController.GetInventoryLookups)
			inventory.GET("/manage", inventoryController.GetInventoryManageData)
			inventory.POST("", inventoryController.CreateInventory)
			inventory.GET("", inventoryController.ViewInventory)
			inventory.PUT("/:id", inventoryController.UpdateInventory)

		}

	}
}
