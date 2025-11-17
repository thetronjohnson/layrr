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
	"strings"
	"time"

	"github.com/gorilla/websocket"
	"github.com/thetronjohnson/layrr/pkg/bridge"
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
	bridge        *bridge.Bridge
	watcher       *watcher.Watcher
	httpServer    *http.Server
	proxy         *httputil.ReverseProxy
	verbose       bool
	reloadClients map[*websocket.Conn]bool
}

// NewServer creates a new asset server
func NewServer(port int, targetPort int, bridge *bridge.Bridge, watcher *watcher.Watcher, verbose bool) *Server {
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
		bridge:        bridge,
		watcher:       watcher,
		proxy:         proxy,
		verbose:       verbose,
		reloadClients: make(map[*websocket.Conn]bool),
	}

	// Set up ModifyResponse once during initialization (thread-safe)
	proxy.ModifyResponse = func(resp *http.Response) error {
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

		// Parse as bridge.Message
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
