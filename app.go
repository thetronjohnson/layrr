package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/thetronjohnson/layrr/pkg/assetserver"
	"github.com/thetronjohnson/layrr/pkg/bridge"
	"github.com/thetronjohnson/layrr/pkg/claude"
	"github.com/thetronjohnson/layrr/pkg/config"
	"github.com/thetronjohnson/layrr/pkg/devserver"
	"github.com/thetronjohnson/layrr/pkg/git"
	"github.com/thetronjohnson/layrr/pkg/proxy"
	"github.com/thetronjohnson/layrr/pkg/status"
	"github.com/thetronjohnson/layrr/pkg/watcher"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx               context.Context
	assetServer       *assetserver.Server
	watcher           *watcher.Watcher
	bridge            *bridge.Bridge
	claudeManager     *claude.Manager
	statusDisplay     *status.Display
	gitManager        *git.GitManager
	devServerManager  *devserver.Manager
	projectDir        string
	assetPort         int
	targetPort        int
	isServerActive    bool
	devServerStarting bool
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{
		assetPort:      9998,
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

	// Initialize git manager
	a.gitManager = git.NewGitManager(a.projectDir)

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
		log.Printf("✅ Project directory set to: %s", a.projectDir)

		// Reinitialize git manager for the new project directory
		a.gitManager = git.NewGitManager(a.projectDir)
	} else {
		log.Printf("⚠️  No project path provided, using default: %s", a.projectDir)
	}

	// Use provided port, stored port, or auto-detect
	var err error
	if targetPort > 0 {
		a.targetPort = targetPort
	} else if a.targetPort > 0 {
		// Use port from auto-started dev server
		log.Printf("Using auto-started dev server on port %d", a.targetPort)
	} else {
		// Fallback to auto-detect dev server port
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

	// Start Claude Code manager
	fmt.Printf("\n[App] 📂 Creating Claude Manager with project directory: %s\n", a.projectDir)
	a.claudeManager, err = claude.NewManager(a.projectDir, "claude", false)
	if err != nil {
		return fmt.Sprintf("Error starting Claude Code: %v", err)
	}
	fmt.Printf("[App] ✅ Claude Manager created successfully\n")

	// Create bridge
	a.bridge = bridge.NewBridge(a.claudeManager, false, a.statusDisplay)

	// Start file watcher
	a.watcher, err = watcher.NewWatcher(a.projectDir, false, a.statusDisplay)
	if err != nil {
		return fmt.Sprintf("Error starting file watcher: %v", err)
	}

	// Create asset server (which also proxies to dev server)
	a.assetServer = assetserver.NewServer(a.assetPort, a.targetPort, a.projectDir, a.bridge, a.watcher, false)

	// Start asset server in goroutine
	go func() {
		if err := a.assetServer.Start(); err != nil {
			log.Printf("Asset server error: %v", err)
			a.isServerActive = false
		}
	}()

	// Give server time to start
	time.Sleep(500 * time.Millisecond)
	a.isServerActive = true

	return fmt.Sprintf("Layrr started - Proxy on port %d, Dev server on port %d", a.assetPort, a.targetPort)
}

// StopProxy stops the asset server
func (a *App) StopProxy() string {
	if !a.isServerActive {
		return "Server is not running"
	}

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Shutdown HTTP server gracefully
	if a.assetServer != nil {
		a.assetServer.Shutdown(ctx)
	}

	// Close watcher
	if a.watcher != nil {
		a.watcher.Close()
	}

	// Stop dev server if running
	if a.devServerManager != nil {
		log.Println("Stopping dev server...")
		if err := a.devServerManager.Stop(); err != nil {
			log.Printf("Warning: Failed to stop dev server: %v", err)
		}
	}

	a.isServerActive = false
	return "Layrr stopped"
}

// GetProxyURL returns the proxy server URL (kept for backward compatibility)
func (a *App) GetProxyURL() string {
	if !a.isServerActive {
		return ""
	}
	return fmt.Sprintf("http://localhost:%d", a.assetPort)
}

// GetProjectInfo returns information about the current project
func (a *App) GetProjectInfo() map[string]interface{} {
	return map[string]interface{}{
		"projectDir":   a.projectDir,
		"proxyPort":    a.assetPort, // Keep field name for backward compatibility
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

	// Reinitialize git manager for the new project directory
	a.gitManager = git.NewGitManager(a.projectDir)

	// Auto-start dev server
	go a.autoStartDevServer(selectedDir)

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

	// Reinitialize git manager for the new project directory
	a.gitManager = git.NewGitManager(a.projectDir)

	// Auto-start dev server
	go a.autoStartDevServer(path)

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

// CreateGitCheckpoint creates a git commit with all current changes
func (a *App) CreateGitCheckpoint(message string) error {
	if !a.gitManager.IsGitRepo() {
		return fmt.Errorf("not a git repository")
	}

	if message == "" {
		return fmt.Errorf("commit message cannot be empty")
	}

	return a.gitManager.CreateCommit(message)
}

// GetGitCommitHistory returns the list of recent commits
func (a *App) GetGitCommitHistory(limit int) ([]git.Commit, error) {
	if !a.gitManager.IsGitRepo() {
		return nil, fmt.Errorf("not a git repository")
	}

	if limit <= 0 {
		limit = 50 // Default to 50 commits
	}

	return a.gitManager.GetCommitHistory(limit)
}

// SwitchToGitCommit checks out a specific commit
func (a *App) SwitchToGitCommit(commitHash string) error {
	if !a.gitManager.IsGitRepo() {
		return fmt.Errorf("not a git repository")
	}

	if commitHash == "" {
		return fmt.Errorf("commit hash cannot be empty")
	}

	return a.gitManager.CheckoutCommit(commitHash)
}

// IsGitRepository checks if the current project is a git repo
func (a *App) IsGitRepository() bool {
	return a.gitManager.IsGitRepo()
}

// GetCurrentGitCommit returns the current commit hash
func (a *App) GetCurrentGitCommit() (string, error) {
	if !a.gitManager.IsGitRepo() {
		return "", fmt.Errorf("not a git repository")
	}
	return a.gitManager.GetCurrentCommitHash()
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
		"proxyPort":    a.assetPort, // Keep field name for backward compatibility
		"targetPort":   a.targetPort,
	}
}

// StopClaudeProcessing stops the currently running Claude Code process
func (a *App) StopClaudeProcessing() error {
	if a.claudeManager == nil {
		return fmt.Errorf("Claude manager not initialized")
	}

	return a.claudeManager.Stop()
}

// autoStartDevServer automatically starts the development server for a project
func (a *App) autoStartDevServer(projectDir string) {
	log.Printf("🚀 Auto-starting dev server for: %s", projectDir)
	a.devServerStarting = true
	defer func() { a.devServerStarting = false }()

	// Stop any existing dev server
	if a.devServerManager != nil {
		log.Println("Stopping existing dev server...")
		if err := a.devServerManager.Stop(); err != nil {
			log.Printf("Warning: Failed to stop existing dev server: %v", err)
		}
	}

	// Create new dev server manager
	a.devServerManager = devserver.NewManager(projectDir)

	// Start the dev server
	if err := a.devServerManager.Start(); err != nil {
		log.Printf("❌ Failed to start dev server: %v", err)
		return
	}

	log.Println("⏳ Waiting for dev server to be ready...")

	// Wait for the server to start (30 second timeout)
	port, err := a.devServerManager.WaitForPort(30 * time.Second)
	if err != nil {
		log.Printf("❌ Dev server failed to start: %v", err)
		return
	}

	// Store the detected port
	a.targetPort = port
	log.Printf("✅ Dev server started successfully on port %d", port)
}

// GetDevServerStatus returns the current status of the dev server
func (a *App) GetDevServerStatus() map[string]interface{} {
	return map[string]interface{}{
		"starting": a.devServerStarting,
		"port":     a.targetPort,
	}
}

// shutdown cleanup function
func (a *App) shutdown(ctx context.Context) {
	log.Println("Shutting down application...")

	// Stop dev server if running
	if a.devServerManager != nil {
		log.Println("Stopping dev server...")
		if err := a.devServerManager.Stop(); err != nil {
			log.Printf("Warning: Failed to stop dev server: %v", err)
		}
	}

	// Stop proxy if active
	if a.isServerActive {
		a.StopProxy()
	}
}
