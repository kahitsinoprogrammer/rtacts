package services

import (
	"backend/config"
	"backend/models"
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/draw"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/xuri/excelize/v2"
	"gorm.io/gorm"
)

type CVService struct{}

const sampleVATTypeID = "11111111-2222-3333-4444-555555555555"
const (
	// Match the visible logo area in the voucher header (columns A:B, rows 1:2).
	logoTargetWidthPx  = 346.0
	logoTargetHeightPx = 64.0
)

func NewCVService() *CVService {
	return &CVService{}
}

func (s *CVService) GetCreateLookups(userID string) (*models.CheckVoucherLookupsResponse, error) {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return nil, err
	}

	suppliers, err := buildSupplierLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	accounts, err := buildAccountLookupOptions(user.CompanyId)
	if err != nil {
		return nil, err
	}

	return &models.CheckVoucherLookupsResponse{
		Suppliers: suppliers,
		Accounts:  accounts,
	}, nil
}

func (s *CVService) ViewCheckVouchers(userID string) ([]models.CheckVoucher, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	var vouchers []models.CheckVoucher
	err = config.DB.
		Model(&models.CheckVoucher{}).
		Where("company_id = ?", user.CompanyId).
		Preload("Supplier").
		Preload("PreparedByUser").
		Preload("ApprovedByUser").
		Preload("Items").
		Preload("Items.Account").
		Order("created_at DESC").
		Find(&vouchers).Error
	if err != nil {
		return nil, err
	}

	return vouchers, nil
}

func (s *CVService) CreateCheckVoucher(userID string, req models.CreateCheckVoucherRequest) (*models.CheckVoucher, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.Users
	if err := config.DB.Where("user_id = ?", uid).First(&user).Error; err != nil {
		return nil, errors.New("user not found")
	}

	if len(req.Items) == 0 {
		return nil, errors.New("items are required")
	}

	voucher := &models.CheckVoucher{
		SupplierID: req.SupplierID,
		CompanyID:  user.CompanyId,
		PreparedBy: &uid,
		Status:     "awaiting approval",
	}

	err = config.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(voucher).Error; err != nil {
			return err
		}

		items := make([]models.CheckVoucherItem, 0, len(req.Items))
		for _, item := range req.Items {
			items = append(items, models.CheckVoucherItem{
				CheckVoucherID: voucher.ID,
				AccountID:      item.AccountID,
				Debit:          item.Debit,
				Credit:         item.Credit,
				VatTypeID:      item.VatTypeID,
				LineNo:         item.LineNo,
			})
		}

		if err := tx.Create(&items).Error; err != nil {
			return err
		}

		voucher.Items = items
		return nil
	})
	if err != nil {
		return nil, err
	}

	return voucher, nil
}

func (s *CVService) DownloadApprovedCheckVoucherExcel(userID string, voucherID string) ([]byte, string, error) {
	user, err := getCurrentUserByID(strings.TrimSpace(userID))
	if err != nil {
		return nil, "", err
	}

	voucherID = strings.TrimSpace(voucherID)
	if voucherID == "" {
		return nil, "", errors.New("check voucher id is required")
	}

	voucher, err := s.getVoucherForExport(user.CompanyId, voucherID)
	if err != nil {
		return nil, "", err
	}

	if !strings.EqualFold(strings.TrimSpace(voucher.Status), "Approved") {
		return nil, "", errors.New("check voucher must be approved before downloading")
	}

	company, err := s.getCompanyByID(voucher.CompanyID)
	if err != nil {
		return nil, "", err
	}

	fileBytes, err := buildCheckVoucherExcel(voucher, company)
	if err != nil {
		return nil, "", err
	}

	filename := fmt.Sprintf("check_disbursement_voucher_%s.xlsx", sanitizeFilename(voucher.ID))
	return fileBytes, filename, nil
}

func (s *CVService) UpdateCheckVoucherStatus(userID string, voucherID string, req models.UpdateCheckVoucherStatusRequest) error {
	user, err := getCurrentUserByID(userID)
	if err != nil {
		return err
	}

	voucherID = strings.TrimSpace(voucherID)
	if voucherID == "" {
		return errors.New("check voucher id is required")
	}

	status := strings.TrimSpace(strings.ToLower(req.Status))
	if status == "" {
		return errors.New("status is required")
	}

	rejectRemarks := strings.TrimSpace(derefOptionalString(req.RejectRemarks))

	return config.DB.Transaction(func(tx *gorm.DB) error {
		var voucher models.CheckVoucher
		if err := tx.
			Where("id = ? AND company_id = ?", voucherID, user.CompanyId).
			First(&voucher).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("check voucher not found")
			}
			return err
		}

		currentStatus := strings.TrimSpace(strings.ToLower(voucher.Status))
		if currentStatus == "approved" || currentStatus == "rejected" {
			return errors.New("check voucher has already been finalized")
		}

		now := time.Now().UTC()
		updates := map[string]interface{}{
			"updated_at": now,
		}

		switch status {
		case "approved":
			updates["status"] = "Approved"
			updates["approved_by"] = user.UserID
			updates["approved_date"] = now
			updates["reject_remarks"] = nil
		case "rejected":
			if rejectRemarks == "" {
				return errors.New("reject_remarks is required when rejecting")
			}
			updates["status"] = "Rejected"
			updates["approved_by"] = nil
			updates["approved_date"] = nil
			updates["reject_remarks"] = rejectRemarks
		default:
			return errors.New("status must be Approved or Rejected")
		}

		return tx.Model(&models.CheckVoucher{}).
			Where("id = ? AND company_id = ?", voucherID, user.CompanyId).
			Updates(updates).Error
	})
}

func (s *CVService) getVoucherForExport(companyID uuid.UUID, voucherID string) (models.CheckVoucher, error) {
	var voucher models.CheckVoucher
	err := config.DB.
		Where("id = ? AND company_id = ?", voucherID, companyID).
		Preload("Supplier").
		Preload("PreparedByUser").
		Preload("ApprovedByUser").
		Preload("Items", func(db *gorm.DB) *gorm.DB {
			return db.Order("line_no ASC")
		}).
		Preload("Items.Account").
		First(&voucher).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.CheckVoucher{}, errors.New("check voucher not found")
		}
		return models.CheckVoucher{}, err
	}

	return voucher, nil
}

func (s *CVService) getCompanyByID(companyID uuid.UUID) (models.Companies, error) {
	var company models.Companies
	if err := config.DB.Where("company_id = ?", companyID).First(&company).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Companies{}, errors.New("company not found")
		}
		return models.Companies{}, err
	}

	return company, nil
}

func buildCheckVoucherExcel(voucher models.CheckVoucher, company models.Companies) ([]byte, error) {
	f := excelize.NewFile()
	defer func() {
		_ = f.Close()
	}()

	sheet := f.GetSheetName(0)
	if err := f.SetSheetName(sheet, "Voucher"); err != nil {
		return nil, err
	}
	sheet = "Voucher"

	for column, width := range map[string]float64{
		"A": 14,
		"B": 34,
		"C": 14,
		"D": 14,
		"E": 16,
		"F": 14,
		"G": 14,
	} {
		if err := f.SetColWidth(sheet, column, column, width); err != nil {
			return nil, err
		}
	}

	for row, height := range map[int]float64{
		1:  24,
		2:  24,
		3:  20,
		6:  20,
		8:  18,
		9:  18,
		20: 18,
	} {
		if err := f.SetRowHeight(sheet, row, height); err != nil {
			return nil, err
		}
	}

	thinBorder := []excelize.Border{
		{Type: "left", Color: "000000", Style: 1},
		{Type: "right", Color: "000000", Style: 1},
		{Type: "top", Color: "000000", Style: 1},
		{Type: "bottom", Color: "000000", Style: 1},
	}

	titleStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 15},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border:    thinBorder,
	})
	if err != nil {
		return nil, err
	}

	companyFallbackStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 16, Color: "2F6B1C"},
		Alignment: &excelize.Alignment{Horizontal: "left", Vertical: "center", WrapText: true},
	})
	if err != nil {
		return nil, err
	}

	labelStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true},
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	fieldStyle, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	fieldEmphasisStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true},
		Border:    thinBorder,
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"#E7E7E7"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "right", Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	groupHeaderStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Underline: "single"},
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	tableHeaderStyle, err := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true},
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center", WrapText: true},
	})
	if err != nil {
		return nil, err
	}

	tableTextStyle, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	tableMoneyStyle, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		NumFmt:    4,
		Alignment: &excelize.Alignment{Horizontal: "right", Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	descriptionStyle, err := f.NewStyle(&excelize.Style{
		Border:    thinBorder,
		Alignment: &excelize.Alignment{Vertical: "top", WrapText: true},
	})
	if err != nil {
		return nil, err
	}

	signatureValueStyle, err := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "bottom", Color: "000000", Style: 1},
		},
		Alignment: &excelize.Alignment{Vertical: "center"},
	})
	if err != nil {
		return nil, err
	}

	if err := f.MergeCell(sheet, "C1", "G2"); err != nil {
		return nil, err
	}
	f.SetCellValue(sheet, "C1", "Check Disbursement Voucher")
	if err := f.SetCellStyle(sheet, "C1", "G2", titleStyle); err != nil {
		return nil, err
	}

	logoInserted := false
	if strings.TrimSpace(company.CompanyPic) != "" {
		logoInserted, _ = insertCompanyLogo(f, sheet, company.CompanyPic)
	}
	if !logoInserted {
		if err := f.MergeCell(sheet, "A1", "B3"); err != nil {
			return nil, err
		}
		f.SetCellValue(sheet, "A1", strings.TrimSpace(company.CompanyName))
		if err := f.SetCellStyle(sheet, "A1", "B3", companyFallbackStyle); err != nil {
			return nil, err
		}
	}

	preparedDate := voucher.CreatedAt.Format("1/2/2006")
	approvedDate := formatOptionalDate(voucher.ApprovedDate)

	if err := setMergedField(f, sheet, "A4", "CV no.", "B4", "C4", formatVoucherNumber(voucher.ID), labelStyle, fieldEmphasisStyle); err != nil {
		return nil, err
	}
	if err := setMergedField(f, sheet, "E4", "Prep Date:", "F4", "G4", preparedDate, labelStyle, fieldStyle); err != nil {
		return nil, err
	}

	if err := setMergedField(f, sheet, "E5", "Doc. Date:", "F5", "G5", approvedDate, labelStyle, fieldStyle); err != nil {
		return nil, err
	}

	f.SetCellValue(sheet, "A6", "Supplier Name:")
	if err := f.SetCellStyle(sheet, "A6", "A6", labelStyle); err != nil {
		return nil, err
	}
	if err := f.MergeCell(sheet, "B6", "G6"); err != nil {
		return nil, err
	}
	f.SetCellValue(sheet, "B6", buildSupplierName(voucher))
	if err := f.SetCellStyle(sheet, "B6", "G6", fieldStyle); err != nil {
		return nil, err
	}

	f.SetCellValue(sheet, "A7", "Entries:")
	if err := f.SetCellStyle(sheet, "A7", "A7", labelStyle); err != nil {
		return nil, err
	}

	if err := f.MergeCell(sheet, "A8", "B8"); err != nil {
		return nil, err
	}
	if err := f.MergeCell(sheet, "C8", "D8"); err != nil {
		return nil, err
	}
	if err := f.MergeCell(sheet, "E8", "E9"); err != nil {
		return nil, err
	}
	if err := f.MergeCell(sheet, "F8", "F9"); err != nil {
		return nil, err
	}
	if err := f.MergeCell(sheet, "G8", "G9"); err != nil {
		return nil, err
	}

	f.SetCellValue(sheet, "A8", "Accounts")
	f.SetCellValue(sheet, "C8", "Amounts")
	f.SetCellValue(sheet, "E8", "VAT type")
	f.SetCellValue(sheet, "F8", "WH ATC")
	f.SetCellValue(sheet, "G8", "WH rate")
	f.SetCellValue(sheet, "A9", "Acct. No.")
	f.SetCellValue(sheet, "B9", "Acct. Name")
	f.SetCellValue(sheet, "C9", "Dr.")
	f.SetCellValue(sheet, "D9", "Cr.")

	if err := f.SetCellStyle(sheet, "A8", "G9", tableHeaderStyle); err != nil {
		return nil, err
	}
	if err := f.SetCellStyle(sheet, "A8", "D8", groupHeaderStyle); err != nil {
		return nil, err
	}

	tableStartRow := 10
	totalRows := len(voucher.Items)
	if totalRows < 8 {
		totalRows = 8
	}

	for i := 0; i < totalRows; i++ {
		row := tableStartRow + i
		if err := f.SetRowHeight(sheet, row, 20); err != nil {
			return nil, err
		}
		textRangeEnd := fmt.Sprintf("G%d", row)
		if err := f.SetCellStyle(sheet, fmt.Sprintf("A%d", row), textRangeEnd, tableTextStyle); err != nil {
			return nil, err
		}
		if err := f.SetCellStyle(sheet, fmt.Sprintf("C%d", row), fmt.Sprintf("D%d", row), tableMoneyStyle); err != nil {
			return nil, err
		}

		if i >= len(voucher.Items) {
			continue
		}

		item := voucher.Items[i]
		f.SetCellValue(sheet, fmt.Sprintf("A%d", row), formatAccountNumber(item.AccountID))
		f.SetCellValue(sheet, fmt.Sprintf("B%d", row), buildAccountName(item))
		if item.Debit != 0 {
			f.SetCellValue(sheet, fmt.Sprintf("C%d", row), item.Debit)
		}
		if item.Credit != 0 {
			f.SetCellValue(sheet, fmt.Sprintf("D%d", row), item.Credit)
		}
		f.SetCellValue(sheet, fmt.Sprintf("E%d", row), buildVATTypeLabel(item.VatTypeID))
	}

	descriptionRow := tableStartRow + totalRows + 1
	descriptionEndRow := descriptionRow + 2
	f.SetCellValue(sheet, fmt.Sprintf("A%d", descriptionRow), "Description:")
	if err := f.SetCellStyle(sheet, fmt.Sprintf("A%d", descriptionRow), fmt.Sprintf("A%d", descriptionRow), labelStyle); err != nil {
		return nil, err
	}
	if err := f.MergeCell(sheet, fmt.Sprintf("B%d", descriptionRow), fmt.Sprintf("G%d", descriptionEndRow)); err != nil {
		return nil, err
	}
	if err := f.SetCellStyle(sheet, fmt.Sprintf("B%d", descriptionRow), fmt.Sprintf("G%d", descriptionEndRow), descriptionStyle); err != nil {
		return nil, err
	}

	signatureStartRow := descriptionEndRow + 2
	if err := addSignatureRow(f, sheet, signatureStartRow, "Prepared by:", buildUserFullName(voucher.PreparedByUser), preparedDate, labelStyle, signatureValueStyle); err != nil {
		return nil, err
	}
	if err := addSignatureRow(f, sheet, signatureStartRow+1, "Reviewed by:", "", "", labelStyle, signatureValueStyle); err != nil {
		return nil, err
	}
	if err := addSignatureRow(f, sheet, signatureStartRow+2, "Approved by:", buildUserFullName(voucher.ApprovedByUser), approvedDate, labelStyle, signatureValueStyle); err != nil {
		return nil, err
	}

	buffer, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}

	return buffer.Bytes(), nil
}

func setMergedField(f *excelize.File, sheet string, labelCell string, label string, startCell string, endCell string, value string, labelStyle int, valueStyle int) error {
	f.SetCellValue(sheet, labelCell, label)
	if err := f.SetCellStyle(sheet, labelCell, labelCell, labelStyle); err != nil {
		return err
	}
	if err := f.MergeCell(sheet, startCell, endCell); err != nil {
		return err
	}
	f.SetCellValue(sheet, startCell, value)
	return f.SetCellStyle(sheet, startCell, endCell, valueStyle)
}

func addSignatureRow(f *excelize.File, sheet string, row int, label string, value string, dateValue string, labelStyle int, valueStyle int) error {
	labelCell := fmt.Sprintf("A%d", row)
	valueStart := fmt.Sprintf("B%d", row)
	valueEnd := fmt.Sprintf("D%d", row)
	dateLabelCell := fmt.Sprintf("E%d", row)
	dateValueStart := fmt.Sprintf("F%d", row)
	dateValueEnd := fmt.Sprintf("G%d", row)

	f.SetCellValue(sheet, labelCell, label)
	if err := f.SetCellStyle(sheet, labelCell, labelCell, labelStyle); err != nil {
		return err
	}
	if err := f.MergeCell(sheet, valueStart, valueEnd); err != nil {
		return err
	}
	f.SetCellValue(sheet, valueStart, value)
	if err := f.SetCellStyle(sheet, valueStart, valueEnd, valueStyle); err != nil {
		return err
	}

	f.SetCellValue(sheet, dateLabelCell, "Date:")
	if err := f.SetCellStyle(sheet, dateLabelCell, dateLabelCell, labelStyle); err != nil {
		return err
	}
	if err := f.MergeCell(sheet, dateValueStart, dateValueEnd); err != nil {
		return err
	}
	f.SetCellValue(sheet, dateValueStart, dateValue)
	return f.SetCellStyle(sheet, dateValueStart, dateValueEnd, valueStyle)
}

func insertCompanyLogo(f *excelize.File, sheet string, logoURL string) (bool, error) {
	fileBytes, extension, err := downloadLogoBytes(logoURL)
	if err != nil {
		return false, err
	}

	preparedBytes, preparedExtension, imageWidth, imageHeight, err := prepareLogoForPlacement(fileBytes, extension)
	if err != nil {
		return false, err
	}

	scaleX, scaleY, offsetX, offsetY := buildFixedLogoPlacement(imageWidth, imageHeight)

	if err := f.AddPictureFromBytes(sheet, "A1", &excelize.Picture{
		Extension: preparedExtension,
		File:      preparedBytes,
		Format: &excelize.GraphicOptions{
			AltText:         "Company Logo",
			OffsetX:         offsetX,
			OffsetY:         offsetY,
			ScaleX:          scaleX,
			ScaleY:          scaleY,
			LockAspectRatio: true,
		},
	}); err != nil {
		return false, err
	}

	return true, nil
}

func prepareLogoForPlacement(fileBytes []byte, extension string) ([]byte, string, int, int, error) {
	decodedImage, _, err := image.Decode(bytes.NewReader(fileBytes))
	if err != nil {
		imageConfig, _, configErr := image.DecodeConfig(bytes.NewReader(fileBytes))
		if configErr != nil {
			return nil, "", 0, 0, err
		}
		return fileBytes, extension, imageConfig.Width, imageConfig.Height, nil
	}

	trimmedImage := trimLogoWhitespace(decodedImage)
	bounds := trimmedImage.Bounds()

	if bounds.Dx() == decodedImage.Bounds().Dx() && bounds.Dy() == decodedImage.Bounds().Dy() {
		return fileBytes, extension, bounds.Dx(), bounds.Dy(), nil
	}

	var buffer bytes.Buffer
	if err := png.Encode(&buffer, trimmedImage); err != nil {
		return nil, "", 0, 0, err
	}

	return buffer.Bytes(), ".png", bounds.Dx(), bounds.Dy(), nil
}

func buildFixedLogoPlacement(sourceWidth int, sourceHeight int) (float64, float64, int, int) {
	if sourceWidth <= 0 || sourceHeight <= 0 {
		return 1, 1, 0, 0
	}

	widthScale := logoTargetWidthPx / float64(sourceWidth)
	heightScale := logoTargetHeightPx / float64(sourceHeight)
	scale := widthScale
	if heightScale < scale {
		scale = heightScale
	}
	if scale <= 0 {
		scale = 1
	}

	renderedWidth := float64(sourceWidth) * scale
	renderedHeight := float64(sourceHeight) * scale
	offsetX := int((logoTargetWidthPx - renderedWidth) / 2)
	offsetY := int((logoTargetHeightPx - renderedHeight) / 2)
	if offsetX < 0 {
		offsetX = 0
	}
	if offsetY < 0 {
		offsetY = 0
	}

	return scale, scale, offsetX, offsetY
}

type logoPixelSample struct {
	r uint8
	g uint8
	b uint8
	a uint8
}

func trimLogoWhitespace(src image.Image) image.Image {
	bounds := src.Bounds()
	if bounds.Dx() <= 0 || bounds.Dy() <= 0 {
		return src
	}

	background, hasBackground := detectLogoBackground(src, bounds)
	minX := bounds.Max.X
	minY := bounds.Max.Y
	maxX := bounds.Min.X - 1
	maxY := bounds.Min.Y - 1

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			if isLogoBackgroundPixel(src.At(x, y), background, hasBackground) {
				continue
			}

			if x < minX {
				minX = x
			}
			if y < minY {
				minY = y
			}
			if x > maxX {
				maxX = x
			}
			if y > maxY {
				maxY = y
			}
		}
	}

	if maxX < minX || maxY < minY {
		return src
	}

	const padding = 4
	if minX > bounds.Min.X {
		minX -= padding
		if minX < bounds.Min.X {
			minX = bounds.Min.X
		}
	}
	if minY > bounds.Min.Y {
		minY -= padding
		if minY < bounds.Min.Y {
			minY = bounds.Min.Y
		}
	}
	if maxX < bounds.Max.X-1 {
		maxX += padding
		if maxX > bounds.Max.X-1 {
			maxX = bounds.Max.X - 1
		}
	}
	if maxY < bounds.Max.Y-1 {
		maxY += padding
		if maxY > bounds.Max.Y-1 {
			maxY = bounds.Max.Y - 1
		}
	}

	if minX == bounds.Min.X && minY == bounds.Min.Y && maxX == bounds.Max.X-1 && maxY == bounds.Max.Y-1 {
		return src
	}

	trimmedBounds := image.Rect(0, 0, maxX-minX+1, maxY-minY+1)
	trimmed := image.NewRGBA(trimmedBounds)
	draw.Draw(trimmed, trimmedBounds, src, image.Point{X: minX, Y: minY}, draw.Src)

	return trimmed
}

func detectLogoBackground(src image.Image, bounds image.Rectangle) (logoPixelSample, bool) {
	samples := []logoPixelSample{
		readLogoPixelSample(src.At(bounds.Min.X, bounds.Min.Y)),
		readLogoPixelSample(src.At(bounds.Max.X-1, bounds.Min.Y)),
		readLogoPixelSample(src.At(bounds.Min.X, bounds.Max.Y-1)),
		readLogoPixelSample(src.At(bounds.Max.X-1, bounds.Max.Y-1)),
	}

	for i := range samples {
		matchCount := 1
		totalR := int(samples[i].r)
		totalG := int(samples[i].g)
		totalB := int(samples[i].b)
		totalA := int(samples[i].a)

		for j := i + 1; j < len(samples); j++ {
			if !logoSamplesSimilar(samples[i], samples[j]) {
				continue
			}

			matchCount++
			totalR += int(samples[j].r)
			totalG += int(samples[j].g)
			totalB += int(samples[j].b)
			totalA += int(samples[j].a)
		}

		if matchCount >= 3 {
			return logoPixelSample{
				r: uint8(totalR / matchCount),
				g: uint8(totalG / matchCount),
				b: uint8(totalB / matchCount),
				a: uint8(totalA / matchCount),
			}, true
		}
	}

	return logoPixelSample{}, false
}

func isLogoBackgroundPixel(pixel interface {
	RGBA() (uint32, uint32, uint32, uint32)
}, background logoPixelSample, hasBackground bool) bool {
	sample := readLogoPixelSample(pixel)
	if sample.a <= 8 {
		return true
	}

	if !hasBackground {
		return false
	}

	return logoSamplesSimilar(sample, background)
}

func logoSamplesSimilar(left logoPixelSample, right logoPixelSample) bool {
	const colorTolerance = 24
	const alphaTolerance = 32

	return absInt(int(left.r)-int(right.r)) <= colorTolerance &&
		absInt(int(left.g)-int(right.g)) <= colorTolerance &&
		absInt(int(left.b)-int(right.b)) <= colorTolerance &&
		absInt(int(left.a)-int(right.a)) <= alphaTolerance
}

func readLogoPixelSample(pixel interface {
	RGBA() (uint32, uint32, uint32, uint32)
}) logoPixelSample {
	r, g, b, a := pixel.RGBA()
	return logoPixelSample{
		r: uint8(r >> 8),
		g: uint8(g >> 8),
		b: uint8(b >> 8),
		a: uint8(a >> 8),
	}
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}

	return value
}

func downloadLogoBytes(rawURL string) ([]byte, string, error) {
	parsedURL, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return nil, "", err
	}

	client := http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(parsedURL.String())
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("failed to load company logo: %s", resp.Status)
	}

	fileBytes, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return nil, "", err
	}

	return fileBytes, detectImageExtension(parsedURL, resp.Header.Get("Content-Type")), nil
}

func detectImageExtension(parsedURL *url.URL, contentType string) string {
	extension := strings.ToLower(path.Ext(parsedURL.Path))
	if extension != "" {
		return extension
	}

	if contentType != "" {
		if extensions, err := mime.ExtensionsByType(contentType); err == nil && len(extensions) > 0 {
			return extensions[0]
		}
	}

	return ".png"
}

func formatVoucherNumber(voucherID string) string {
	trimmed := strings.TrimSpace(strings.TrimPrefix(voucherID, "CV-"))
	if trimmed == "" {
		return strings.TrimSpace(voucherID)
	}
	return trimmed
}

func sanitizeFilename(value string) string {
	replacer := strings.NewReplacer(" ", "_", "/", "-", "\\", "-", ":", "-", "*", "-", "?", "", "\"", "", "<", "", ">", "", "|", "")
	return replacer.Replace(strings.TrimSpace(value))
}

func buildSupplierNumber(voucher models.CheckVoucher) string {
	if voucher.Supplier != nil {
		if taxID := strings.TrimSpace(voucher.Supplier.TaxID); taxID != "" {
			return taxID
		}
		if voucher.Supplier.SupplierID != uuid.Nil {
			return voucher.Supplier.SupplierID.String()
		}
	}

	if voucher.SupplierID != uuid.Nil {
		return voucher.SupplierID.String()
	}

	return ""
}

func buildSupplierName(voucher models.CheckVoucher) string {
	if voucher.Supplier == nil {
		return ""
	}
	return strings.TrimSpace(voucher.Supplier.SupplierName)
}

func formatOptionalDate(value *time.Time) string {
	if value == nil || value.IsZero() {
		return ""
	}
	return value.Format("1/2/2006")
}

func buildUserFullName(user *models.Users) string {
	if user == nil {
		return ""
	}

	parts := []string{
		strings.TrimSpace(user.FirstName),
		strings.TrimSpace(user.MiddleName),
		strings.TrimSpace(user.LastName),
	}

	filtered := make([]string, 0, len(parts))
	for _, part := range parts {
		if part != "" {
			filtered = append(filtered, part)
		}
	}

	if len(filtered) == 0 {
		return strings.TrimSpace(user.Username)
	}

	return strings.Join(filtered, " ")
}

func formatAccountNumber(accountID *int) string {
	if accountID == nil {
		return ""
	}
	return strconv.Itoa(*accountID)
}

func buildAccountName(item models.CheckVoucherItem) string {
	if item.Account == nil {
		return ""
	}

	name := strings.TrimSpace(item.Account.AccountDescription)
	longDesc := strings.TrimSpace(item.Account.AccountLongDesc)
	if name == "" {
		return longDesc
	}
	if longDesc == "" {
		return name
	}
	return fmt.Sprintf("%s - %s", name, longDesc)
}

func buildVATTypeLabel(vatTypeID *uuid.UUID) string {
	if vatTypeID == nil {
		return ""
	}

	value := strings.TrimSpace(vatTypeID.String())
	if value == "" {
		return ""
	}
	if value == sampleVATTypeID {
		return "VAT SAMPLE"
	}
	return value
}

func derefOptionalString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}
