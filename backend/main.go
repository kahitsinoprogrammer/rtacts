package main

import (
	"backend/config"
	"backend/models"
	"backend/routes"
	"fmt"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"time"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		fmt.Println("No .env file found")
	} else {
		fmt.Println("Loaded .env")
	}

	config.ConnectDatabase()

	if err := config.DB.AutoMigrate(&models.Companies{}); err != nil {
		panic(fmt.Sprintf("failed to migrate companies: %v", err))
	}

	r := gin.Default()

	// ✅ Enable CORS globally BEFORE routes
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// ✅ Register your routes
	routes.RegisterRoutes(r)

	// ✅ Start the server
	r.Run(":8080")
}
