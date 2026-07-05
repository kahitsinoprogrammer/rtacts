package models

import (
	"time"

	"github.com/google/uuid"
)

type UpdateCompanySettingsRequest struct {
	CompanyName    string `json:"company_name"`
	Tin            string `json:"tin"`
	CompanyEmail   string `json:"company_email"`
	CompanyPhone   string `json:"company_phone"`
	CompanyAddress string `json:"company_address"`
	CompanyPic     string `json:"company_pic"`
	BlockNo        string `json:"block_no"`
	City           string `json:"city"`
	Province       string `json:"province"`
	Country        string `json:"country"`
	Zip            string `json:"zip"`
}

type CompanySettingsResponse struct {
	CompanyID      uuid.UUID `json:"company_id"`
	CompanyName    string    `json:"company_name"`
	Tin            string    `json:"tin"`
	CompanyEmail   string    `json:"company_email"`
	CompanyPhone   string    `json:"company_phone"`
	CompanyAddress string    `json:"company_address"`
	CompanyPic     string    `json:"company_pic"`
	BlockNo        string    `json:"block_no"`
	City           string    `json:"city"`
	Province       string    `json:"province"`
	Country        string    `json:"country"`
	Zip            string    `json:"zip"`
	DateCreated    time.Time `json:"date_created"`
	DateUpdated    time.Time `json:"date_updated"`
}
