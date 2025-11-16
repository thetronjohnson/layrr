package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/thetronjohnson/layrr/pkg/bridge"
	"github.com/thetronjohnson/layrr/pkg/claude"
	"github.com/thetronjohnson/layrr/pkg/config"
	"github.com/thetronjohnson/layrr/pkg/proxy"
	"github.com/thetronjohnson/layrr/pkg/status"
	"github.com/thetronjohnson/layrr/pkg/tui"
	"github.com/thetronjohnson/layrr/pkg/watcher"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx            context.Context
	server         *proxy.Server
	watcher        *watcher.Watcher
	bridge         *bridge.Bridge
	claudeManager  *claude.Manager
	tuiProgram     *tea.Program
	statusDisplay  *status.Display
	projectDir     string
	proxyPort      int
	targetPort     int
	isServerActive bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		proxyPort:      9999,
		targetPort:     0, // Will be auto-detected
		isServerActive: false,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Get current working directory as default project directory
	cwd, err := os.Getwd()
	if err != nil {
		log.Printf("Error getting current directory: %v", err)
		return
	}
	a.projectDir = cwd

	// Initialize status display
	a.statusDisplay = status.NewDisplay()

	log.Println("Layrr app started successfully")
}

// StartProxy initializes and starts the proxy server for a given project
func (a *App) StartProxy(projectPath string, targetPort int) string {
	if a.isServerActive {
		return "Proxy server is already running"
	}

	// Update project directory
	if projectPath != "" {
		a.projectDir = projectPath
	}

	// Use provided port or auto-detect
	var err error
	if targetPort > 0 {
		a.targetPort = targetPort
	} else {
		// Auto-detect dev server port
		detectedPort, err := proxy.DetectDevServer()
		if err != nil {
			return fmt.Sprintf("Error: Could not detect dev server. Please start your dev server first or specify a port. %v", err)
		}
		a.targetPort = detectedPort
	}

	// Ensure Anthropic API key is available
	if err = a.ensureAPIKey(); err != nil {
		return fmt.Sprintf("Error: %v. Please set your Anthropic API key.", err)
	}

	// Initialize TUI (without alt screen since we're in a GUI)
	tuiModel := tui.NewModel()
	a.tuiProgram = tea.NewProgram(tuiModel)

	// Start Claude Code manager
	a.claudeManager, err = claude.NewManager(a.projectDir, "claude", false)
	if err != nil {
		return fmt.Sprintf("Error starting Claude Code: %v", err)
	}

	// Connect manager to TUI
	a.claudeManager.SetProgram(a.tuiProgram)

	// Create bridge
	a.bridge = bridge.NewBridge(a.claudeManager, false, a.statusDisplay)
	a.bridge.SetProgram(a.tuiProgram)

	// Start file watcher
	a.watcher, err = watcher.NewWatcher(a.projectDir, false, a.statusDisplay)
	if err != nil {
		return fmt.Sprintf("Error starting file watcher: %v", err)
	}

	// Create proxy server
	a.server = proxy.NewServer(a.proxyPort, a.targetPort, a.bridge, a.watcher, false, a.projectDir)

	// Start server in goroutine
	go func() {
		if err := a.server.Start(); err != nil {
			log.Printf("Server error: %v", err)
			a.isServerActive = false
		}
	}()

	// Give server time to start
	time.Sleep(500 * time.Millisecond)
	a.isServerActive = true

	return fmt.Sprintf("Proxy server started on port %d, forwarding to port %d", a.proxyPort, a.targetPort)
}

// StopProxy stops the proxy server
func (a *App) StopProxy() string {
	if !a.isServerActive {
		return "Proxy server is not running"
	}

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Shutdown HTTP server gracefully
	if a.server != nil {
		a.server.Shutdown(ctx)
	}

	// Close watcher
	if a.watcher != nil {
		a.watcher.Close()
	}

	a.isServerActive = false
	return "Proxy server stopped"
}

// GetProxyURL returns the proxy URL
func (a *App) GetProxyURL() string {
	if !a.isServerActive {
		return ""
	}
	return fmt.Sprintf("http://localhost:%d", a.proxyPort)
}

// GetProjectInfo returns information about the current project
func (a *App) GetProjectInfo() map[string]interface{} {
	return map[string]interface{}{
		"projectDir":   a.projectDir,
		"proxyPort":    a.proxyPort,
		"targetPort":   a.targetPort,
		"serverActive": a.isServerActive,
	}
}

// SelectProjectDirectory opens a directory picker and sets the project directory
func (a *App) SelectProjectDirectory() (string, error) {
	selectedDir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title:            "Select Project Directory",
		DefaultDirectory: a.projectDir,
	})

	if err != nil {
		return "", fmt.Errorf("failed to open directory dialog: %w", err)
	}

	// User cancelled
	if selectedDir == "" {
		return a.projectDir, nil
	}

	// Update project directory
	a.projectDir = selectedDir
	log.Printf("Project directory changed to: %s", selectedDir)

	// Add to recent projects
	projectName := filepath.Base(selectedDir)
	if err := config.AddRecentProject(selectedDir, projectName, a.targetPort); err != nil {
		log.Printf("Warning: Failed to add to recent projects: %v", err)
	}

	return selectedDir, nil
}

// GetRecentProjects returns the list of recently opened projects
func (a *App) GetRecentProjects() ([]config.RecentProject, error) {
	return config.GetRecentProjects()
}

// AddRecentProject adds a project to the recent projects list
func (a *App) AddRecentProject(path, name string, targetPort int) error {
	return config.AddRecentProject(path, name, targetPort)
}

// RemoveRecentProject removes a project from the recent projects list
func (a *App) RemoveRecentProject(path string) error {
	return config.RemoveRecentProject(path)
}

// OpenRecentProject loads a recent project
func (a *App) OpenRecentProject(path string, targetPort int) string {
	// Verify directory still exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Sprintf("Error: Project directory no longer exists: %s", path)
	}

	a.projectDir = path
	a.targetPort = targetPort
	log.Printf("Opened recent project: %s", path)

	// Update recent projects list
	projectName := filepath.Base(path)
	if err := config.AddRecentProject(path, projectName, targetPort); err != nil {
		log.Printf("Warning: Failed to update recent projects: %v", err)
	}

	return fmt.Sprintf("Project loaded: %s", path)
}

// DetectRunningPorts detects all running dev servers on common ports
func (a *App) DetectRunningPorts() []int {
	return proxy.DetectAllRunningPorts()
}

// DetectPortsWithInfo detects all running dev servers with process and folder information
func (a *App) DetectPortsWithInfo() []proxy.PortInfo {
	return proxy.DetectPortsWithInfo()
}

// ensureAPIKey checks for Anthropic API key
func (a *App) ensureAPIKey() error {
	// Try to find existing API key
	_, err := config.GetAnthropicAPIKey(a.projectDir)
	if err == nil {
		log.Println("✓ Anthropic API key found")
		return nil
	}

	// Check environment variable
	if os.Getenv("ANTHROPIC_API_KEY") != "" {
		return nil
	}

	// Check global config
	homeDir, err := os.UserHomeDir()
	if err == nil {
		claudeDir := filepath.Join(homeDir, ".claude")
		if _, err := os.Stat(filepath.Join(claudeDir, "settings.json")); err == nil {
			_, err := config.GetAnthropicAPIKey(claudeDir)
			if err == nil {
				return nil
			}
		}
	}

	return fmt.Errorf("Anthropic API key not found. Please set it in the app")
}

// SetAPIKey saves the Anthropic API key
func (a *App) SetAPIKey(apiKey string) error {
	if apiKey == "" {
		return fmt.Errorf("API key cannot be empty")
	}

	// Save to project .claude/settings.json
	if err := config.CreateProjectSettings(a.projectDir, apiKey); err != nil {
		return fmt.Errorf("failed to save API key: %w", err)
	}

	log.Println("✓ API key saved to .claude/settings.json")
	return nil
}

// GetStatus returns the current status of the app
func (a *App) GetStatus() map[string]interface{} {
	return map[string]interface{}{
		"serverActive": a.isServerActive,
		"projectDir":   a.projectDir,
		"proxyPort":    a.proxyPort,
		"targetPort":   a.targetPort,
	}
}
