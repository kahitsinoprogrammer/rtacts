package services

import (
	"backend/models"
	"errors"
	"os"
	"time"
	"github.com/golang-jwt/jwt/v5"
)

type TokenService struct {
    secret []byte
}

func NewTokenService() *TokenService {
    return &TokenService{
        secret: []byte(os.Getenv("JWT_SECRET")),
    }
}

func (t *TokenService) GenerateToken(user models.Users) (string, error) {
    claims := jwt.MapClaims{
        "user_id":  user.UserID,
        "username": user.Username,
        "exp":      time.Now().Add(24 * time.Hour).Unix(),
    }

    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(t.secret)
}

func (t *TokenService) GetUserIDFromToken(tokenString string) (string, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, errors.New("invalid signing method")
        }
        return t.secret, nil
    })

    if err != nil {
        return "", err
    }

    if !token.Valid {
        return "", errors.New("invalid token")
    }

    claims, ok := token.Claims.(jwt.MapClaims)
    if !ok {
        return "", errors.New("invalid claims")
    }

    rawUserID, ok := claims["user_id"]
    if !ok {
        return "", errors.New("user_id not found")
    }

    userID, ok := rawUserID.(string)
    if !ok {
        return "", errors.New("user_id is not a string")
    }

    return userID, nil
}

