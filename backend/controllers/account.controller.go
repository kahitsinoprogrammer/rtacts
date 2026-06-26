package controllers

import (
	"backend/models"
	"backend/services"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type AccountController struct {
	accountService *services.AccountService
	tokenService   *services.TokenService
}

func NewAccountController() *AccountController {

	return &AccountController{
		accountService: services.NewAccountService(),
		tokenService:   services.NewTokenService(),
	}
}

/* ================================
   ========== CREATE ACCOUNT ======
   ================================ */

func (ac *AccountController) CreateAccount(c *gin.Context) {

	var req models.CreateAccountRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var creatorUserID string
	if tokenString, err := c.Cookie("auth_token"); err == nil && tokenString != "" {
		creatorUserID, err = ac.tokenService.GetUserIDFromToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}
	}

	company, user, err := ac.accountService.CreateAccount(req, creatorUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Account created successfully",
		"company": company,
		"user":    user,
	})

}

/* ================================
   ============ VERIFY OTP ========
   ================================ */

func (ac *AccountController) VerifyOTP(c *gin.Context) {

	var req models.VerifyOTPRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data"})
		return
	}

	if err := ac.accountService.VerifyOTP(req); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "OTP verified successfully!",
		"user_id": req.UserID,
	})
}

func (ac *AccountController) Login(c *gin.Context) {
	var req models.LoginRequest

	// 1. Bind JSON
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	// 2. Check credentials
	user, err := ac.accountService.Login(req)
	if err != nil {
		// Keep this generic so you don't leak which one is wrong
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid username or password",
		})
		return
	}

	// 3. Generate JWT
	token, err := ac.tokenService.GenerateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate token",
		})
		return
	}

	// 4. Set JWT as HttpOnly cookie
	c.SetCookie(
		"auth_token", // name
		token,        // value
		24*60*60,     // maxAge (seconds) -> 1 day
		"/",          // path
		"localhost",  // domain (ok for dev; change in prod)
		false,        // secure (true in prod with HTTPS)
		true,         // httpOnly
	)

	// 5. Success – no user data/token returned
	c.JSON(http.StatusOK, gin.H{
		"message": "Login successful",
	})
}

func (ac *AccountController) AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Read JWT from cookie
		tokenString, err := c.Cookie("auth_token")
		if err != nil || tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized",
			})
			return
		}

		// 2. Validate token and get userID from payload
		userID, err := ac.tokenService.GetUserIDFromToken(tokenString)
		if err != nil || userID == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "Invalid or expired token",
			})
			return
		}

		// 3. Store userID in context so handlers can use it
		c.Set("userID", userID)

		c.Next()
	}
}

func (ac *AccountController) Me(c *gin.Context) {
	userIDVal, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, ok := userIDVal.(string)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid user id type"})
		return
	}

	user, err := ac.accountService.FindByID(userID) // adjust name if different
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"UserID":     user.UserID,
		"Username":   user.Username,
		"Email":      user.Email,
		"FirstName":  user.FirstName,
		"LastName":   user.LastName,
		"MiddleName": user.MiddleName,
		"UserType":   user.UserType,
		"CompanyId":  user.CompanyId,
	})
}

func (ac *AccountController) ViewAccounts(c *gin.Context) {
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

	rows, err := ac.accountService.ViewAccounts(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, rows)
}

func (ac *AccountController) UpdateAccount(c *gin.Context) {
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

	accountID := strings.TrimSpace(c.Param("id"))
	if accountID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account id is required"})
		return
	}

	var req models.UpdateAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if err := ac.accountService.UpdateAccount(userID, accountID, req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

func (ac *AccountController) Logout(c *gin.Context) {
	// Clear the cookie (maxAge = -1 deletes it)
	c.SetCookie(
		"auth_token",
		"",
		-1, // maxAge < 0 means delete cookie
		"/",
		"",    // domain: "" = current host (localhost)
		false, // secure: false for HTTP in dev; true in prod HTTPS
		true,  // httpOnly
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out",
	})
}
