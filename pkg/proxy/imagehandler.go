package proxy

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// SaveImageToProject saves a base64-encoded image to the project's public/images/ directory
// and returns the relative path for use in Next.js Image components
func SaveImageToProject(imageBase64, imageType, projectDir string) (string, error) {
	// 1. Ensure public/images/ directory exists
	imagesDir := filepath.Join(projectDir, "public", "images")
	if err := ensurePublicImagesDir(imagesDir); err != nil {
		return "", err
	}

	// 2. Generate unique filename with appropriate extension
	ext := getImageExtension(imageType)
	filename := generateUniqueFilename(ext)

	// 3. Decode base64 image data
	imageData, err := base64.StdEncoding.DecodeString(imageBase64)
	if err != nil {
		return "", fmt.Errorf("failed to decode image data: %w", err)
	}

	// 4. Validate image size (max 5MB for actual assets)
	const maxSize = 5 * 1024 * 1024 // 5MB
	if len(imageData) > maxSize {
		return "", fmt.Errorf("image size (%d bytes) exceeds maximum allowed size (5MB)", len(imageData))
	}

	// 5. Write image file
	filePath := filepath.Join(imagesDir, filename)
	if err := os.WriteFile(filePath, imageData, 0644); err != nil {
		return "", fmt.Errorf("failed to write image file: %w", err)
	}

	// 6. Return relative path for Next.js (e.g., "/images/1732241234-image.jpg")
	relativePath := "/images/" + filename

	fmt.Printf("[ImageHandler] ✅ Image saved successfully:\n")
	fmt.Printf("  File: %s\n", filePath)
	fmt.Printf("  Path for code: %s\n", relativePath)

	return relativePath, nil
}

// ensurePublicImagesDir creates the public/images/ directory if it doesn't exist
func ensurePublicImagesDir(imagesDir string) error {
	if err := os.MkdirAll(imagesDir, 0755); err != nil {
		return fmt.Errorf("failed to create images directory: %w", err)
	}
	return nil
}

// generateUniqueFilename creates a unique filename using timestamp
func generateUniqueFilename(ext string) string {
	timestamp := time.Now().Unix()
	return fmt.Sprintf("%d-image%s", timestamp, ext)
}

// getImageExtension returns the appropriate file extension for the given MIME type
func getImageExtension(mimeType string) string {
	// Normalize MIME type
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))

	switch mimeType {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	case "image/svg+xml", "image/svg":
		return ".svg"
	default:
		// Default to .jpg if unknown
		return ".jpg"
	}
}

// ValidateImageType checks if the MIME type is supported
func ValidateImageType(mimeType string) bool {
	supportedTypes := []string{
		"image/jpeg",
		"image/jpg",
		"image/png",
		"image/webp",
		"image/gif",
		"image/svg+xml",
		"image/svg",
	}

	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	for _, supported := range supportedTypes {
		if mimeType == supported {
			return true
		}
	}
	return false
}

// ImageInfo represents metadata about an image file
type ImageInfo struct {
	Path    string    `json:"path"`    // Relative path like "/images/hero.jpg"
	Name    string    `json:"name"`    // Just the filename like "hero.jpg"
	Size    int64     `json:"size"`    // File size in bytes
	ModTime time.Time `json:"modTime"` // Modification time for sorting
}

// ListImagesInPublic scans the public directory recursively and returns all image files
func ListImagesInPublic(projectDir string) ([]ImageInfo, error) {
	publicDir := filepath.Join(projectDir, "public")
	var images []ImageInfo

	fmt.Printf("[ImageHandler] Scanning directory: %s\n", publicDir)

	// Check if public directory exists
	if _, err := os.Stat(publicDir); os.IsNotExist(err) {
		fmt.Printf("[ImageHandler] ⚠️  Public directory does not exist: %s\n", publicDir)
		return images, nil // Return empty list if no public directory
	}

	fmt.Printf("[ImageHandler] ✅ Public directory exists, scanning for images...\n")

	// Walk through public directory recursively
	err := filepath.Walk(publicDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Check if file is an image based on extension
		ext := strings.ToLower(filepath.Ext(path))
		if ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".webp" || ext == ".gif" || ext == ".svg" {
			// Get relative path from public directory
			relPath, err := filepath.Rel(publicDir, path)
			if err != nil {
				return err
			}

			// Convert to web path (forward slashes, prepend /)
			webPath := "/" + filepath.ToSlash(relPath)

			images = append(images, ImageInfo{
				Path:    webPath,
				Name:    info.Name(),
				Size:    info.Size(),
				ModTime: info.ModTime(),
			})
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to scan public directory: %w", err)
	}

	// Sort images by modification time (newest first)
	sort.Slice(images, func(i, j int) bool {
		return images[i].ModTime.After(images[j].ModTime)
	})

	return images, nil
}
