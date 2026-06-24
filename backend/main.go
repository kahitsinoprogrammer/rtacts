package main

import (
    "backend/config"
    "backend/routes"
    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
    "time"
    "github.com/joho/godotenv"
    "fmt"
)

func main() {
    
 err := godotenv.Load()
    if err != nil {
        fmt.Println("No .env file found")
    } else {
        fmt.Println("Loaded .env")
    }


    config.ConnectDatabase()

    r := gin.Default()

    // ✅ Enable CORS globally BEFORE routes
    r.Use(cors.New(cors.Config{
        AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
        AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"},
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
