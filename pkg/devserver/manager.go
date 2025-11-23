package devserver

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/thetronjohnson/layrr/pkg/proxy"
)

type Manager struct {
	projectDir     string
	cmd            *exec.Cmd
	port           int
	packageManager string
	devScript      string
	existingPorts  map[int]bool // Ports that were already open before we started
}

type packageJSON struct {
	Scripts map[string]string `json:"scripts"`
}

// NewManager creates a new dev server manager for the given project
func NewManager(projectDir string) *Manager {
	return &Manager{
		projectDir: projectDir,
	}
}

// DetectPackageManager detects which package manager the project uses
func (m *Manager) DetectPackageManager() (string, error) {
	// Check for lock files in priority order: bun > pnpm > yarn > npm
	checks := []struct {
		file    string
		manager string
	}{
		{"bun.lockb", "bun"},
		{"pnpm-lock.yaml", "pnpm"},
		{"yarn.lock", "yarn"},
		{"package-lock.json", "npm"},
	}

	for _, check := range checks {
		lockPath := filepath.Join(m.projectDir, check.file)
		if _, err := os.Stat(lockPath); err == nil {
			return check.manager, nil
		}
	}

	// Default to npm if no lock file found
	return "npm", nil
}

// GetDevScript reads the dev script from package.json
func (m *Manager) GetDevScript() (string, error) {
	pkgPath := filepath.Join(m.projectDir, "package.json")
	data, err := os.ReadFile(pkgPath)
	if err != nil {
		return "", fmt.Errorf("failed to read package.json: %w", err)
	}

	var pkg packageJSON
	if err := json.Unmarshal(data, &pkg); err != nil {
		return "", fmt.Errorf("failed to parse package.json: %w", err)
	}

	if devScript, ok := pkg.Scripts["dev"]; ok {
		return devScript, nil
	}

	// Fallback to "start" if "dev" doesn't exist
	if startScript, ok := pkg.Scripts["start"]; ok {
		return startScript, nil
	}

	return "", fmt.Errorf("no 'dev' or 'start' script found in package.json")
}

// killExistingServers attempts to kill any dev servers on common ports
func (m *Manager) killExistingServers() {
	commonPorts := []int{5173, 3000, 8080, 4200, 8000, 5000, 8888, 3001, 4000, 9000}

	for _, port := range commonPorts {
		// Check if port is in use
		addr := fmt.Sprintf("localhost:%d", port)
		conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err == nil {
			// Port is open, try to kill the process
			conn.Close()
			m.killProcessOnPort(port)
		}
	}
}

// killProcessOnPort kills the process listening on the given port and waits for port to close
func (m *Manager) killProcessOnPort(port int) {
	// Use lsof to find the LISTENING process only (not clients connected to it)
	cmd := exec.Command("lsof", "-ti", fmt.Sprintf(":%d", port), "-sTCP:LISTEN")
	output, err := cmd.Output()
	if err != nil {
		return
	}

	// Kill the process - IMPORTANT: trim whitespace/newlines from PID
	pid := strings.TrimSpace(string(output))
	if len(pid) > 0 {
		killCmd := exec.Command("kill", "-9", pid)
		if err := killCmd.Run(); err != nil {
			fmt.Printf("Warning: Failed to kill process %s: %v\n", pid, err)
			return
		}

		// Wait for the port to actually close (max 5 seconds)
		for i := 0; i < 50; i++ {
			time.Sleep(100 * time.Millisecond)

			// Check if port is still open
			addr := fmt.Sprintf("localhost:%d", port)
			conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
			if err != nil {
				// Port is closed, success!
				return
			}
			conn.Close()
		}

		fmt.Printf("Warning: Port %d still open after 5 seconds\n", port)
	}
}

// Start starts the dev server
func (m *Manager) Start() error {
	// Detect package manager
	pm, err := m.DetectPackageManager()
	if err != nil {
		return fmt.Errorf("failed to detect package manager: %w", err)
	}
	m.packageManager = pm

	// Get dev script
	script, err := m.GetDevScript()
	if err != nil {
		return fmt.Errorf("failed to get dev script: %w", err)
	}
	m.devScript = script

	// Snapshot existing ports BEFORE starting the dev server
	m.existingPorts = make(map[int]bool)
	commonPorts := []int{5173, 3000, 8080, 4200, 8000, 5000, 8888, 3001, 4000, 9000}
	for _, port := range commonPorts {
		addr := fmt.Sprintf("localhost:%d", port)
		conn, err := net.DialTimeout("tcp", addr, 500*time.Millisecond)
		if err == nil {
			conn.Close()
			m.existingPorts[port] = true
		}
	}

	// Don't kill existing servers anymore - we just want to detect NEW ports
	// m.killExistingServers()

	// Start the dev server
	m.cmd = exec.Command(m.packageManager, "run", "dev")
	m.cmd.Dir = m.projectDir
	m.cmd.Env = os.Environ()

	// Start the process
	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start dev server: %w", err)
	}

	return nil
}

// WaitForPort waits for the dev server to start and returns the port
func (m *Manager) WaitForPort(timeout time.Duration) (int, error) {
	start := time.Now()

	for {
		// Check if timeout exceeded
		if time.Since(start) > timeout {
			return 0, fmt.Errorf("timeout waiting for dev server to start")
		}

		// Get all currently open ports with full process info
		allPortsInfo := proxy.DetectPortsWithInfo()

		// Check each detected port
		for _, portInfo := range allPortsInfo {
			port := portInfo.Port

			// Skip if this port was already open before we started
			if m.existingPorts[port] {
				continue
			}

			// Verify the working directory matches our project directory
			if portInfo.WorkDir == "" {
				continue // No working directory info, skip
			}

			// Normalize paths for comparison
			normalizedWorkDir := filepath.Clean(portInfo.WorkDir)
			normalizedProjectDir := filepath.Clean(m.projectDir)

			// Check if the process is running in our project directory
			if normalizedWorkDir == normalizedProjectDir || strings.HasPrefix(normalizedWorkDir, normalizedProjectDir+string(filepath.Separator)) {
				// This is a NEW port from our project!
				m.port = port
				return port, nil
			}
		}

		// Wait before checking again
		time.Sleep(500 * time.Millisecond)
	}
}

// GetPort returns the port the dev server is running on
func (m *Manager) GetPort() int {
	return m.port
}

// Stop stops the dev server
func (m *Manager) Stop() error {
	// First, kill the process listening on the port (the actual dev server)
	if m.port > 0 {
		m.killProcessOnPort(m.port)
	}

	// Then kill the parent process (npm/bun/pnpm) as cleanup
	if m.cmd != nil && m.cmd.Process != nil {
		if err := m.cmd.Process.Kill(); err != nil {
			// Don't return error if parent is already dead
			// (it might have been killed when we killed the port process)
			return nil
		}
	}

	return nil
}
