package assetserver

import (
	"bytes"
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/thetronjohnson/layrr/pkg/ai"
	"github.com/thetronjohnson/layrr/pkg/analyzer"
	"github.com/thetronjohnson/layrr/pkg/bridge"
	"github.com/thetronjohnson/layrr/pkg/config"
	"github.com/thetronjohnson/layrr/pkg/proxy"
	"github.com/thetronjohnson/layrr/pkg/watcher"
)

//go:embed assets/*
var assets embed.FS

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local development
	},
}

// Server serves Layrr assets, handles WebSocket communication, and proxies to dev server with script injection
type Server struct {
	port          int
	targetPort    int
	projectDir    string
	bridge        *bridge.Bridge
	watcher       *watcher.Watcher
	httpServer    *http.Server
	proxy         *httputil.ReverseProxy
	verbose       bool
	reloadClients map[*websocket.Conn]bool
}

// NewServer creates a new asset server
func NewServer(port int, targetPort int, projectDir string, bridge *bridge.Bridge, watcher *watcher.Watcher, verbose bool) *Server {
	// Create reverse proxy to dev server
	target := &url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("localhost:%d", targetPort),
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Save original director
	originalDirector := proxy.Director

	// Customize proxy behavior
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Remove Accept-Encoding to prevent compressed responses (so we can inject script)
		req.Header.Del("Accept-Encoding")
	}

	server := &Server{
		port:          port,
		targetPort:    targetPort,
		projectDir:    projectDir,
		bridge:        bridge,
		watcher:       watcher,
		proxy:         proxy,
		verbose:       verbose,
		reloadClients: make(map[*websocket.Conn]bool),
	}

	// Set up ModifyResponse once during initialization (thread-safe)
	proxy.ModifyResponse = func(resp *http.Response) error {
		// Remove X-Frame-Options to allow iframe embedding in Wails app
		resp.Header.Del("X-Frame-Options")
		// Also remove Content-Security-Policy frame-ancestors if present
		csp := resp.Header.Get("Content-Security-Policy")
		if csp != "" {
			// Remove frame-ancestors directive if present
			resp.Header.Set("Content-Security-Policy", strings.ReplaceAll(csp, "frame-ancestors", ""))
		}

		// Only inject into HTML responses
		contentType := resp.Header.Get("Content-Type")
		if !strings.Contains(contentType, "text/html") {
			return nil
		}

		// Read the response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return err
		}
		resp.Body.Close()

		// Inject script before </body>
		bodyStr := string(body)
		if strings.Contains(bodyStr, "</body>") {
			scriptTag := fmt.Sprintf(`<script src="http://localhost:%d/__layrr/inject-minimal.js"></script>`, port)
			bodyStr = strings.Replace(bodyStr, "</body>", scriptTag+"</body>", 1)
		}

		// Update response
		newBody := []byte(bodyStr)
		resp.Body = io.NopCloser(bytes.NewReader(newBody))
		resp.ContentLength = int64(len(newBody))
		resp.Header.Set("Content-Length", fmt.Sprintf("%d", len(newBody)))

		return nil
	}

	// Subscribe to file watcher events
	if watcher != nil {
		watcher.OnChange(func() {
			server.notifyReload()
		})
	}

	return server
}

// notifyReload sends reload notification to all connected clients
func (s *Server) notifyReload() {
	if s.verbose {
		fmt.Println("[Asset Server] 🔄 Notifying clients of file changes")
	}

	for client := range s.reloadClients {
		err := client.WriteJSON(map[string]string{"type": "reload"})
		if err != nil {
			// Client disconnected, remove it
			delete(s.reloadClients, client)
			client.Close()
		}
	}
}

// Start starts the asset server
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Serve inject script
	mux.HandleFunc("/__layrr/inject-minimal.js", s.handleInjectScript)

	// Serve cursor asset
	mux.HandleFunc("/__layrr/cursor.svg", s.handleCursorAsset)

	// WebSocket endpoint for messaging
	mux.HandleFunc("/__layrr/ws/message", s.handleMessageWebSocket)

	// WebSocket endpoint for reload notifications
	mux.HandleFunc("/__layrr/ws/reload", s.handleReloadWebSocket)

	// HTTP endpoint for immediate image upload
	mux.HandleFunc("/__layrr/upload-image", s.handleImageUpload)

	// HTTP endpoint for listing images in public directory
	mux.HandleFunc("/__layrr/list-images", s.handleListImages)

	// Proxy all other requests to dev server with script injection
	mux.HandleFunc("/", s.handleProxyWithInjection)

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: mux,
	}

	fmt.Printf("🚀 Layrr proxy server starting on http://localhost:%d\n", s.port)
	fmt.Printf("   Proxying to: http://localhost:%d\n", s.targetPort)
	return s.httpServer.ListenAndServe()
}

// handleProxyWithInjection proxies requests to dev server (ModifyResponse is already set)
func (s *Server) handleProxyWithInjection(w http.ResponseWriter, r *http.Request) {
	// The ModifyResponse function is already configured in NewServer
	// Just serve the proxied request
	s.proxy.ServeHTTP(w, r)
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}

// handleInjectScript serves the inject script
func (s *Server) handleInjectScript(w http.ResponseWriter, r *http.Request) {
	// Read the inject script from embedded assets
	content, err := assets.ReadFile("assets/inject-minimal.js")
	if err != nil {
		http.Error(w, "Failed to load inject script", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/javascript")
	w.Header().Set("Cache-Control", "no-cache") // No cache during development
	w.Write(content)
}

// handleCursorAsset serves the custom cursor SVG
func (s *Server) handleCursorAsset(w http.ResponseWriter, r *http.Request) {
	content, err := assets.ReadFile("assets/cursor.svg")
	if err != nil {
		http.Error(w, "Failed to load cursor asset", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Write(content)
}

// handleMessageWebSocket handles WebSocket connections for messaging
func (s *Server) handleMessageWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		if s.verbose {
			fmt.Printf("[Asset Server] Failed to upgrade WebSocket: %v\n", err)
		}
		return
	}
	defer conn.Close()

	if s.verbose {
		fmt.Println("[Asset Server] Message WebSocket connected")
	}

	// Read messages from the browser
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}

		fmt.Printf("[Asset Server] 📥 === RECEIVED MESSAGE FROM BROWSER ===\n")
		fmt.Printf("[Asset Server] Raw message: %s\n", string(message))

		// First, check message type
		var msgType struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(message, &msgType); err == nil {
			if msgType.Type == "analyze-design" {
				// Handle design analysis
				s.handleDesignAnalysis(conn, message)
				continue
			} else if msgType.Type == "direct-image-replace" {
				// Handle direct image replacement
				s.handleDirectImageReplace(conn, message)
				continue
			}
		}

		// Parse as regular bridge.Message
		var msg bridge.Message
		if err := json.Unmarshal(message, &msg); err != nil {
			fmt.Printf("[Asset Server] ❌ Failed to parse as bridge.Message: %v\n", err)
			continue
		}

		fmt.Printf("[Asset Server] ✅ Successfully parsed as bridge.Message\n")
		fmt.Printf("[Asset Server] Message ID: %d, Instruction: %s\n", msg.ID, msg.Instruction)

		// Send acknowledgment that message was received
		fmt.Printf("[Asset Server] 📨 Sending 'received' ack for message ID %d\n", msg.ID)
		conn.WriteJSON(map[string]interface{}{
			"id":     msg.ID,
			"status": "received",
		})

		// Handle the message (this blocks until Claude Code finishes)
		fmt.Printf("[Asset Server] ⏳ Processing message ID %d...\n", msg.ID)
		err = s.bridge.HandleMessage(msg)

		// Send completion status with write deadline (2 minutes to handle slow connections)
		if err != nil {
			fmt.Printf("[Asset Server] ❌ Sending 'error' status for message ID %d: %v\n", msg.ID, err)
			conn.SetWriteDeadline(time.Now().Add(2 * time.Minute))
			if writeErr := conn.WriteJSON(map[string]interface{}{
				"id":     msg.ID,
				"status": "error",
				"error":  err.Error(),
			}); writeErr != nil {
				fmt.Printf("[Asset Server] ⚠️  Failed to send error to browser: %v (this is safe to ignore if browser already received the update via file watcher)\n", writeErr)
			}
		} else {
			fmt.Printf("[Asset Server] 🎉 Sending 'complete' status for message ID %d\n", msg.ID)
			conn.SetWriteDeadline(time.Now().Add(2 * time.Minute))
			if writeErr := conn.WriteJSON(map[string]interface{}{
				"id":     msg.ID,
				"status": "complete",
			}); writeErr != nil {
				fmt.Printf("[Asset Server] ⚠️  Failed to send completion to browser: %v (this is safe to ignore if browser already received the update via file watcher)\n", writeErr)
			} else {
				fmt.Printf("[Asset Server] ✅ Successfully sent 'complete' for message ID %d\n", msg.ID)
			}
		}
	}
}

// handleReloadWebSocket handles WebSocket connections for reload notifications
func (s *Server) handleReloadWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		if s.verbose {
			fmt.Printf("[Asset Server] Failed to upgrade reload WebSocket: %v\n", err)
		}
		return
	}
	defer func() {
		delete(s.reloadClients, conn)
		conn.Close()
	}()

	// Add client to reload clients
	s.reloadClients[conn] = true

	if s.verbose {
		fmt.Printf("[Asset Server] Reload WebSocket connected (total: %d)\n", len(s.reloadClients))
	}

	// Keep connection alive and wait for close
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}

	if s.verbose {
		fmt.Printf("[Asset Server] Reload WebSocket disconnected (remaining: %d)\n", len(s.reloadClients)-1)
	}
}

// handleDesignAnalysis handles design-to-code image analysis requests
func (s *Server) handleDesignAnalysis(conn *websocket.Conn, message []byte) {
	// Parse the design analysis request
	var req struct {
		Type      string `json:"type"`
		ID        int    `json:"id"`
		Image     string `json:"image"`     // base64 encoded image without prefix
		ImageType string `json:"imageType"` // e.g., "image/png"
		Prompt    string `json:"prompt"`
	}

	if err := json.Unmarshal(message, &req); err != nil {
		fmt.Printf("[Asset Server] ❌ Failed to parse design analysis request: %v\n", err)
		conn.WriteJSON(map[string]interface{}{
			"id":     req.ID,
			"status": "error",
			"error":  fmt.Sprintf("Invalid request format: %v", err),
		})
		return
	}

	fmt.Printf("[Asset Server] 🖼️ === DESIGN ANALYSIS REQUEST ===\n")
	fmt.Printf("[Asset Server] Message ID: %d\n", req.ID)
	fmt.Printf("[Asset Server] Image type: %s\n", req.ImageType)
	fmt.Printf("[Asset Server] User prompt: %s\n", req.Prompt)
	fmt.Printf("[Asset Server] Image size: %d bytes\n", len(req.Image))

	// Send acknowledgment
	conn.WriteJSON(map[string]interface{}{
		"id":     req.ID,
		"status": "received",
	})

	// Get API key from config (checks .claude/settings.json)
	apiKey, err := config.GetAnthropicAPIKey(s.projectDir)
	if err != nil {
		fmt.Printf("[Asset Server] ❌ Failed to get API key: %v\n", err)
		conn.WriteJSON(map[string]interface{}{
			"id":     req.ID,
			"status": "error",
			"error":  "API key not configured. Please set ANTHROPIC_API_KEY in .claude/settings.json",
		})
		return
	}

	// Create AI client
	aiClient := ai.NewClient(apiKey)

	// Call vision API to analyze the design
	fmt.Printf("[Asset Server] 📸 Analyzing design with Claude Vision API...\n")
	analysisText, err := aiClient.AnalyzeDesignImage(req.Image, req.ImageType, req.Prompt)
	if err != nil {
		fmt.Printf("[Asset Server] ❌ Vision API error: %v\n", err)
		conn.SetWriteDeadline(time.Now().Add(2 * time.Minute))
		conn.WriteJSON(map[string]interface{}{
			"id":     req.ID,
			"status": "error",
			"error":  fmt.Sprintf("Vision analysis failed: %v", err),
		})
		return
	}

	fmt.Printf("[Asset Server] ✅ Vision analysis complete\n")
	fmt.Printf("[Asset Server] Analysis length: %d characters\n", len(analysisText))

	// Combine user prompt with vision analysis for Claude Code
	combinedInstruction := fmt.Sprintf(`%s

IMPORTANT: Implement EVERY element described below. Be EXHAUSTIVE and create a complete, production-ready component.

Design Analysis:
%s

Create a complete, production-ready component that matches this design EXACTLY. Include:
- All text content verbatim
- Exact colors and styling
- Proper spacing and layout
- Interactive elements with hover states
- Responsive design considerations`, req.Prompt, analysisText)

	// Create bridge message to send to Claude Code
	bridgeMsg := bridge.Message{
		ID: req.ID,
		Area: bridge.AreaInfo{
			X:            0,
			Y:            0,
			Width:        0,
			Height:       0,
			ElementCount: 0,
			Elements:     []bridge.ElementInfo{},
		},
		Instruction: combinedInstruction,
		Screenshot:  "", // Already analyzed, don't send again
	}

	// Handle the message through the bridge (this blocks until Claude Code finishes)
	fmt.Printf("[Asset Server] ⏳ Processing design implementation...\n")
	err = s.bridge.HandleMessage(bridgeMsg)

	// Send completion status
	conn.SetWriteDeadline(time.Now().Add(2 * time.Minute))
	if err != nil {
		fmt.Printf("[Asset Server] ❌ Claude Code error: %v\n", err)
		conn.WriteJSON(map[string]interface{}{
			"id":     req.ID,
			"status": "error",
			"error":  err.Error(),
		})
	} else {
		fmt.Printf("[Asset Server] 🎉 Design implementation complete\n")
		conn.WriteJSON(map[string]interface{}{
			"id":     req.ID,
			"status": "complete",
		})
	}
}

// handleListImages lists all images in the public directory
func (s *Server) handleListImages(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("[AssetServer] 🔵 handleListImages called - Method: %s, Path: %s\n", r.Method, r.URL.Path)

	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS request
	if r.Method == http.MethodOptions {
		fmt.Printf("[AssetServer] Handling OPTIONS preflight request\n")
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only accept GET requests
	if r.Method != http.MethodGet {
		fmt.Printf("[AssetServer] ❌ Method not allowed: %s\n", r.Method)
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fmt.Printf("[AssetServer] 📋 Listing images in public directory\n")
	fmt.Printf("[AssetServer] Project directory: %s\n", s.projectDir)
	fmt.Printf("[AssetServer] Looking for images in: %s/public\n", s.projectDir)

	// List all images
	images, err := proxy.ListImagesInPublic(s.projectDir)
	if err != nil {
		fmt.Printf("[AssetServer] ❌ Error listing images: %v\n", err)
		http.Error(w, fmt.Sprintf("Failed to list images: %v", err), http.StatusInternalServerError)
		return
	}

	fmt.Printf("[AssetServer] ✅ Found %d images\n", len(images))
	if len(images) > 0 {
		fmt.Printf("[AssetServer] Image paths:\n")
		for _, img := range images {
			fmt.Printf("  - %s (%s, %d bytes)\n", img.Path, img.Name, img.Size)
		}
	}

	// Return as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(images)
}

// handleImageUpload handles immediate image upload when user selects a file
func (s *Server) handleImageUpload(w http.ResponseWriter, r *http.Request) {
	// Set CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	// Handle preflight OPTIONS request
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Only accept POST requests
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse the JSON body
	var requestData struct {
		Image     string `json:"image"`
		ImageType string `json:"imageType"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, fmt.Sprintf("Failed to parse request: %v", err), http.StatusBadRequest)
		return
	}

	fmt.Printf("[AssetServer] 📤 Image upload request received (type: %s, size: %d bytes)\n",
		requestData.ImageType, len(requestData.Image))

	// Validate image type
	if !proxy.ValidateImageType(requestData.ImageType) {
		http.Error(w, fmt.Sprintf("Unsupported image type: %s", requestData.ImageType), http.StatusBadRequest)
		return
	}

	// Check if project is Next.js (for now, only Next.js is supported)
	ctx, err := analyzer.AnalyzeProject(s.projectDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to analyze project: %v", err), http.StatusInternalServerError)
		return
	}

	if ctx.Framework != "nextjs" {
		http.Error(w, "Image attachment is currently only supported for Next.js projects", http.StatusBadRequest)
		return
	}

	// Save the image immediately
	imagePath, err := proxy.SaveImageToProject(requestData.Image, requestData.ImageType, s.projectDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to save image: %v", err), http.StatusInternalServerError)
		return
	}

	fmt.Printf("[AssetServer] ✅ Image saved successfully: %s\n", imagePath)

	// Return the path as JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"path": imagePath,
	})
}

// handleDirectImageReplace handles direct image path replacement without Claude Code
func (s *Server) handleDirectImageReplace(conn *websocket.Conn, message []byte) {
	// Parse the request
	var req struct {
		Type    string `json:"type"`
		Payload struct {
			OldPath     string `json:"oldPath"`
			NewPath     string `json:"newPath"`
			Selector    string `json:"selector"`
			ElementInfo struct {
				TagName   string `json:"tagName"`
				OuterHTML string `json:"outerHTML"`
			} `json:"elementInfo"`
		} `json:"payload"`
	}

	if err := json.Unmarshal(message, &req); err != nil {
		fmt.Printf("[AssetServer] ❌ Failed to parse direct image replace request: %v\n", err)
		conn.WriteJSON(map[string]interface{}{
			"status": "error",
			"error":  fmt.Sprintf("Failed to parse request: %v", err),
		})
		return
	}

	fmt.Printf("[AssetServer] 🔄 Direct image replacement request:\n")
	fmt.Printf("  Old path: %s\n", req.Payload.OldPath)
	fmt.Printf("  New path: %s\n", req.Payload.NewPath)
	fmt.Printf("  Selector: %s\n", req.Payload.Selector)

	// Send acknowledgment
	conn.WriteJSON(map[string]interface{}{
		"status": "received",
	})

	// Do direct string replacement in source files (no AI needed!)
	oldPath := req.Payload.OldPath
	newPath := req.Payload.NewPath

	// Extract original path from Next.js optimized URL if needed
	originalPath := extractOriginalImagePath(oldPath)
	if originalPath != oldPath {
		fmt.Printf("[AssetServer] 📦 Detected Next.js URL, extracted original: %s\n", originalPath)
		oldPath = originalPath
	}

	fmt.Printf("[AssetServer] 🔍 Searching for files containing: %s\n", oldPath)

	// Search all source files in the project
	replaced, err := s.replaceImagePathInFiles(oldPath, newPath)

	// Send response
	conn.SetWriteDeadline(time.Now().Add(2 * time.Minute))
	if err != nil {
		fmt.Printf("[AssetServer] ❌ Image replacement failed: %v\n", err)
		conn.WriteJSON(map[string]interface{}{
			"status": "error",
			"error":  err.Error(),
		})
	} else if !replaced {
		fmt.Printf("[AssetServer] ⚠️ Image path not found in any file\n")
		conn.WriteJSON(map[string]interface{}{
			"status": "error",
			"error":  "Image path not found in source files",
		})
	} else {
		fmt.Printf("[AssetServer] ✅ Image path replaced successfully\n")
		conn.WriteJSON(map[string]interface{}{
			"status": "complete",
		})
	}
}

// replaceImagePathInFiles searches and replaces image path in all source files
func (s *Server) replaceImagePathInFiles(oldPath, newPath string) (bool, error) {
	extensions := []string{".tsx", ".ts", ".jsx", ".js", ".vue", ".svelte"}
	replaced := false

	err := filepath.Walk(s.projectDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			if info.Name() == "node_modules" || info.Name() == ".git" || info.Name() == "dist" || info.Name() == "build" {
				return filepath.SkipDir
			}
			return nil
		}

		validExt := false
		for _, ext := range extensions {
			if strings.HasSuffix(path, ext) {
				validExt = true
				break
			}
		}
		if !validExt {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		contentStr := string(content)
		if !strings.Contains(contentStr, oldPath) {
			return nil
		}

		fmt.Printf("[AssetServer] 📝 Found in: %s\n", path)
		newContent := strings.ReplaceAll(contentStr, oldPath, newPath)

		err = os.WriteFile(path, []byte(newContent), info.Mode())
		if err != nil {
			return fmt.Errorf("failed to write file %s: %w", path, err)
		}

		fmt.Printf("[AssetServer] ✅ Replaced in: %s\n", path)
		replaced = true
		return nil
	})

	return replaced, err
}

// extractOriginalImagePath extracts the original image path from Next.js optimized URLs
// E.g., "/_next/image?url=%2Favatar.webp&w=3840&q=75" -> "/avatar.webp"
func extractOriginalImagePath(path string) string {
	// Check if this is a Next.js image URL
	if !strings.Contains(path, "/_next/image") {
		return path
	}

	// Parse URL to extract query parameters
	if strings.Contains(path, "url=") {
		// Find url= parameter
		parts := strings.Split(path, "url=")
		if len(parts) < 2 {
			return path
		}

		// Get the URL-encoded path
		encodedPath := parts[1]

		// Remove any other query parameters after it
		if ampIndex := strings.Index(encodedPath, "&"); ampIndex != -1 {
			encodedPath = encodedPath[:ampIndex]
		}

		// Decode URL encoding
		decodedPath := strings.ReplaceAll(encodedPath, "%2F", "/")
		decodedPath = strings.ReplaceAll(decodedPath, "%2f", "/")
		decodedPath = strings.ReplaceAll(decodedPath, "%20", " ")

		fmt.Printf("[AssetServer] Extracted path from Next.js URL: %s -> %s\n", path, decodedPath)
		return decodedPath
	}

	return path
}
